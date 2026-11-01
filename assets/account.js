/* =========================================================
   SESSION COMMUNE des pages sans compte : aucun élément d'interface.
   Lit le jeton d'un lien email au retour sur la page et expose la session dans
   window.PortfolioAccount (status : connecté, invité, déconnecté). Ne crée jamais de session.
   Les pages qui ont déjà un client (Casino, Monopoly, Mii) passent par le même createAccount.
   ========================================================= */
import { createAccount } from '../mii/lib/account.js';

try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    createAccount(createClient);
} catch (e) {
    console.warn('Session indisponible :', e);
}
