using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Wed_Project.Models;
using Wed_Project.Security;
using Wed_Project.Services.Otp;

namespace Wed_Project.Services.Auth
{
    public class AuthService : IAuthService
    {
        private const string DefaultUserRoleName = "User";

        private readonly AppDbContext _dbContext;
        private readonly IEmailOtpService _emailOtpService;
        private readonly ILogger<AuthService> _logger;

        public AuthService(
            AppDbContext dbContext,
            IEmailOtpService emailOtpService,
            ILogger<AuthService> logger)
        {
            _dbContext = dbContext;
            _emailOtpService = emailOtpService;
            _logger = logger;
        }

        public async Task<RegisterServiceResult> RegisterAsync(
            RegisterRequest request,
            string requestIp,
            CancellationToken cancellationToken)
        {
            var username = request.Username.Trim();
            var fullName = request.FullName.Trim();
            var email = request.Email.Trim().ToLowerInvariant();

            var validationErrors = new Dictionary<string, string[]>();

            if (string.IsNullOrWhiteSpace(username))
            {
                validationErrors[nameof(RegisterRequest.Username)] = ["Username không được để trống."];
            }

            if (string.IsNullOrWhiteSpace(fullName))
            {
                validationErrors[nameof(RegisterRequest.FullName)] = ["Họ tên không được để trống."];
            }

            if (!request.AcceptTerms)
            {
                validationErrors[nameof(RegisterRequest.AcceptTerms)] = ["Bạn cần đồng ý với điều khoản sử dụng."];
            }

            if (!HasStrongPassword(request.Password))
            {
                validationErrors[nameof(RegisterRequest.Password)] =
                    ["Mật khẩu cần có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số."];
            }

            var usernameExists = await _dbContext.Users
                .AnyAsync(x => x.Username == username, cancellationToken);

            if (usernameExists)
            {
                validationErrors[nameof(RegisterRequest.Username)] = ["Tên đăng nhập đã tồn tại."];
            }

            var emailExists = await _dbContext.Users
                .AnyAsync(x => x.Email == email, cancellationToken);

            if (emailExists)
            {
                validationErrors[nameof(RegisterRequest.Email)] = ["Email đã được sử dụng."];
            }

            if (validationErrors.Count > 0)
            {
                return new RegisterServiceResult
                {
                    Success = false,
                    ValidationErrors = validationErrors
                };
            }

            var roleId = await EnsureDefaultUserRoleIdAsync(cancellationToken);
            var now = DateTime.UtcNow;

            var user = new User
            {
                Username = username,
                FullName = fullName,
                Email = email,
                PasswordHash = PasswordHashUtility.HashPassword(request.Password),
                RoleId = roleId,
                IsLocked = false,
                IsEmailVerified = false,
                CreatedAt = now
            };

            _dbContext.Users.Add(user);

            try
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                return new RegisterServiceResult
                {
                    Success = false,
                    IsConflict = true,
                    Message = "Tên đăng nhập hoặc email đã tồn tại."
                };
            }

            _logger.LogInformation("Registered new user UserId={UserId} Username={Username}", user.UserId, user.Username);

            var otpDispatch = await _emailOtpService.IssueRegisterOtpAsync(user, requestIp, cancellationToken);

            return new RegisterServiceResult
            {
                Success = true,
                Response = new RegisterResponse
                {
                    UserId = user.UserId,
                    Username = user.Username,
                    FullName = user.FullName,
                    Email = user.Email,
                    CreatedAt = user.CreatedAt,
                    IsEmailVerified = user.IsEmailVerified,
                    OtpDispatched = otpDispatch.Success,
                    OtpExpiresAt = otpDispatch.ExpiresAt,
                    Message = otpDispatch.Success
                        ? "Đăng ký thành công. Vui lòng kiểm tra email để nhập OTP xác thực."
                        : "Đăng ký thành công nhưng chưa gửi được OTP. Vui lòng gửi lại OTP."
                }
            };
        }

        public Task<OtpVerificationResult> VerifyEmailOtpAsync(
            VerifyEmailOtpRequest request,
            CancellationToken cancellationToken)
        {
            return _emailOtpService.VerifyRegisterOtpAsync(
                request.Email,
                request.OtpCode,
                cancellationToken);
        }

        public Task<OtpDispatchResult> ResendEmailOtpAsync(
            ResendEmailOtpRequest request,
            string requestIp,
            CancellationToken cancellationToken)
        {
            return _emailOtpService.ResendRegisterOtpAsync(
                request.Email,
                requestIp,
                cancellationToken);
        }

        private async Task<int> EnsureDefaultUserRoleIdAsync(CancellationToken cancellationToken)
        {
            var existingRole = await _dbContext.Roles
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.RoleName == DefaultUserRoleName, cancellationToken);

            if (existingRole is not null)
            {
                return existingRole.RoleId;
            }

            var role = new Role { RoleName = DefaultUserRoleName };
            _dbContext.Roles.Add(role);

            try
            {
                await _dbContext.SaveChangesAsync(cancellationToken);
                return role.RoleId;
            }
            catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex))
            {
                _dbContext.Entry(role).State = EntityState.Detached;

                var fallback = await _dbContext.Roles
                    .AsNoTracking()
                    .FirstAsync(x => x.RoleName == DefaultUserRoleName, cancellationToken);

                return fallback.RoleId;
            }
        }

        private static bool HasStrongPassword(string password)
        {
            if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            {
                return false;
            }

            var hasUpper = Regex.IsMatch(password, "[A-Z]");
            var hasLower = Regex.IsMatch(password, "[a-z]");
            var hasDigit = Regex.IsMatch(password, "[0-9]");

            return hasUpper && hasLower && hasDigit;
        }

        private static bool IsUniqueConstraintViolation(DbUpdateException exception)
        {
            return exception.InnerException is SqlException sqlException &&
                   (sqlException.Number == 2601 || sqlException.Number == 2627);
        }
    }
}
