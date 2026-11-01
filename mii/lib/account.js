/* =========================================================
   COMPTE (optionnel) : Supabase Auth, e-mail / mot de passe ou Google.
   createClient est injecté : la page Mii le prend sur le CDN,
   le Casino utilise celui de son bundle.
   La session est gardée sous la même clé sur tout le portfolio,
   donc une connexion sur la chaîne Mii vaut aussi pour le Casino.
   Un seul client par page : window.PortfolioAccount, annoncé par
   l'événement « portfolio-account ».
   ========================================================= */

export const SUPABASE_URL = 'https://api.alixcorbin.com';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa2JoZ213eWxsZXRtZG1zbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzQ2MzYsImV4cCI6MjA5MjQ1MDYzNn0.Vp6CfEi3dtUL1Z1h8kYkrCAXBMlBuSogocffaKE_9tw';
const STORAGE_KEY = 'portfolio-auth';

const ERRORS_FR = {
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
    'Email not confirmed': 'Confirme ton adresse e-mail (lien reçu par mail) avant de te connecter.',
    'User already registered': 'Un compte existe déjà avec cette adresse.',
    'Password should be at least 6 characters.': 'Le mot de passe doit faire au moins 6 caractères.',
};

export function createAccount(createClient) {
    if (window.PortfolioAccount) return window.PortfolioAccount;
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: STORAGE_KEY },
    });
    let user = null;
    let session = null;
    // Session anonyme automatique (Casino) : invisible pour l'UI, ce n'est pas un vrai compte
    const real = (u) => (u && !u.is_anonymous ? u : null);
    let recovering = false;
    const listeners = new Set();
    const emit = (event) => listeners.forEach((fn) => { try { fn(user, event); } catch { /* ignore */ } });

    // Lien à jeton direct (#access_token) : le flux PKCE de ce client ne le lit pas tout seul.
    const hash = new URLSearchParams(location.hash.slice(1));
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    const fromLink = access_token && refresh_token
        ? sb.auth.setSession({ access_token, refresh_token }).then(() => history.replaceState(null, '', location.pathname + location.search)).catch(() => null)
        : Promise.resolve();
    const ready = fromLink.then(() => sb.auth.getSession()).then(({ data }) => { session = data.session; user = real(session?.user); emit('INIT'); return user; }).catch(() => null);
    sb.auth.onAuthStateChange((event, next_session) => {
        session = next_session;
        const next = real(next_session?.user);
        if (event === 'PASSWORD_RECOVERY') recovering = true;
        if (next?.id === user?.id && event !== 'PASSWORD_RECOVERY' && event !== 'USER_UPDATED') return;
        user = next;
        emit(event);
    });

    const here = () => location.origin + location.pathname;
    const wrap = async (p) => {
        const { data, error } = await p;
        if (error) throw new Error(ERRORS_FR[error.message] || error.message);
        return data;
    };

    const api = {
        sb,
        ready,
        get user() { return user; },
        get session() { return session; },
        get status() { return !session ? 'déconnecté' : session.user?.is_anonymous ? 'invité' : 'connecté'; },
        get recovering() { return recovering; },
        displayName() {
            if (!user) return '';
            return user.user_metadata?.full_name || user.user_metadata?.name || user.email || '';
        },
        onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        signIn: (email, password) => wrap(sb.auth.signInWithPassword({ email, password })),
        signUp: (email, password) => wrap(sb.auth.signUp({ email, password, options: { emailRedirectTo: here() } })),
        google: () => wrap(sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } })),
        // Rattache Discord au compte en cours (compte anonyme du Casino compris), sans en créer un autre
        linkDiscord: () => wrap(sb.auth.linkIdentity({ provider: 'discord', options: { redirectTo: here() } })),
        resetPassword: (email) => wrap(sb.auth.resetPasswordForEmail(email, { redirectTo: here() })),
        updatePassword: async (password) => { const d = await wrap(sb.auth.updateUser({ password })); recovering = false; return d; },
        signOut: () => wrap(sb.auth.signOut()),
    };
    window.PortfolioAccount = api;
    window.dispatchEvent(new Event('portfolio-account'));
    return api;
}
