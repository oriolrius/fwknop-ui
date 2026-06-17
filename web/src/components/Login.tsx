import { motion } from 'framer-motion';
import { LogIn, ShieldCheck, Zap } from 'lucide-react';

// Full-screen gate shown when OIDC is enabled and the user is not authenticated.
// "Sign in" hands off to the server's /auth/login, which redirects to the IdP.
export function Login() {
  const signIn = () => {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    window.location.assign(`/auth/login?returnTo=${returnTo}`);
  };

  return (
    <div className="login-screen">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      >
        <div className="login-brand">
          <span className="brand-glyph">
            <Zap size={20} strokeWidth={2.4} />
          </span>
          <div>
            <div className="brand-name">
              fwknop<b>·</b>spa
            </div>
            <div className="brand-sub">single packet auth</div>
          </div>
        </div>

        <div className="login-lede">
          <ShieldCheck size={15} />
          <span>This console is protected. Sign in with your identity provider to continue.</span>
        </div>

        <button className="btn btn-primary login-btn" onClick={signIn}>
          <LogIn size={16} /> Sign in with SSO
        </button>
      </motion.div>
    </div>
  );
}
