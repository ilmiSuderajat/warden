export { };

declare global {
    interface Window {
        AndroidBridge?: {
            loginWithGoogle: () => void;
        };
        onNativeGoogleLogin?: (idToken: string) => void;
    }
}
