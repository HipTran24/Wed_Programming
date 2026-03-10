using Wed_Project.Models;

namespace Wed_Project.Services.Otp
{
    public interface IEmailOtpService
    {
        Task<OtpDispatchResult> IssueRegisterOtpAsync(User user, string requestIp, CancellationToken cancellationToken);

        Task<OtpVerificationResult> VerifyRegisterOtpAsync(string email, string otpCode, CancellationToken cancellationToken);

        Task<OtpDispatchResult> ResendRegisterOtpAsync(string email, string requestIp, CancellationToken cancellationToken);
    }

    public sealed class OtpDispatchResult
    {
        public bool Success { get; init; }

        public string Message { get; init; } = string.Empty;

        public DateTime? ExpiresAt { get; init; }
    }

    public sealed class OtpVerificationResult
    {
        public bool Success { get; init; }

        public string Message { get; init; } = string.Empty;
    }
}
