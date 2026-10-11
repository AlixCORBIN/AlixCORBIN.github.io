/* =========================================================
   COMPTE (optionnel) : Supabase Auth, e-mail / mot de passe ou Google.
   createClient est injecté : la page Mii le prend sur le CDN,
   le Casino utilise celui de son bundle.
   La session est gardée sous la même clé sur tout le portfolio,
   donc une connexion sur la chaîne Mii vaut aussi pour le Casino.
   ========================================================= */

export const SUPABASE_URL = 'https://njkbhgmwylletmdmsmyl.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_VYQeM9TBjjoqs4CeAT06mQ_1AJ4uf7p';
const STORAGE_KEY = 'portfolio-auth';

const ERRORS_FR = {
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
    'Email not confirmed': 'Confirme ton adresse e-mail (lien reçu par mail) avant de te connecter.',
    'User already registered': 'Un compte existe déjà avec cette adresse.',
    'Password should be at least 6 characters.': 'Le mot de passe doit faire au moins 6 caractères.',
};

export function createAccount(createClient) {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: STORAGE_KEY },
    });
    let user = null;
    let recovering = false;
    const listeners = new Set();
    const emit = (event) => listeners.forEach((fn) => { try { fn(user, event); } catch { /* ignore */ } });

    const ready = sb.auth.getSession().then(({ data }) => { user = data.session?.user || null; emit('INIT'); return user; }).catch(() => null);
    sb.auth.onAuthStateChange((event, session) => {
        const next = session?.user || null;
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

    return {
        sb,
        ready,
        get user() { return user; },
        get recovering() { return recovering; },
        displayName() {
            if (!user) return '';
            return user.user_metadata?.full_name || user.user_metadata?.name || user.email || '';
        },
        onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        signIn: (email, password) => wrap(sb.auth.signInWithPassword({ email, password })),
        signUp: (email, password) => wrap(sb.auth.signUp({ email, password, options: { emailRedirectTo: here() } })),
        google: () => wrap(sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } })),
        resetPassword: (email) => wrap(sb.auth.resetPasswordForEmail(email, { redirectTo: here() })),
        updatePassword: async (password) => { const d = await wrap(sb.auth.updateUser({ password })); recovering = false; return d; },
        signOut: () => wrap(sb.auth.signOut()),
    };
}
