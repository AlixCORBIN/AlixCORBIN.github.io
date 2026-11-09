/* ══════════════════════════════════════
   Stats page · script.js
   ══════════════════════════════════════ */

let currentLang = localStorage.getItem('lang') || 'fr';

/* ── Texts (dynamic parts) ── */
const DYN = {
    fr: {
        noData: 'Aucune donnée',
        darkOn: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 3.85718C11.7891 3.85718 12.0004 5.04248 11.4641 5.62132C10.5555 6.60206 10 7.91462 10 9.35718C10 12.3947 12.4624 14.8572 15.5 14.8572C16.9423 14.8572 18.2542 14.3018 19.2346 13.3934C19.8136 12.8568 20.9996 13.0677 21 13.8572C21.0027 18.8277 16.9706 21.8572 12 21.8572C7.02944 21.8572 3 17.8277 3 12.8572C3 7.88661 6.02944 3.85718 11 3.85718Z" fill="currentColor"/></svg></span> Dark mode activé',
        darkOff: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 12.8572C15 14.514 13.6569 15.8572 12 15.8572C10.3431 15.8572 9 14.514 9 12.8572C9 11.2003 10.3431 9.85718 12 9.85718C13.6569 9.85718 15 11.2003 15 12.8572Z" fill="currentColor"/><path d="M11.9994 9.85732C13.6563 9.85732 14.9994 11.2005 14.9994 12.8573C14.9993 14.514 13.6562 15.8573 11.9994 15.8573C10.3429 15.8571 8.99959 14.5139 8.99943 12.8573C8.99943 11.2006 10.3428 9.85754 11.9994 9.85732Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.224 2.71279C13.1976 2.82269 13.8745 3.93342 15.2279 6.1542C17.808 5.82774 19.0985 5.66373 19.7914 6.35635C19.8975 6.46241 19.9909 6.58086 20.0707 6.70791C20.5916 7.53758 20.1456 8.75872 19.2533 11.2011C21.1171 13.0146 22.0492 13.9219 21.9399 14.8954C21.9231 15.0444 21.8898 15.1914 21.8403 15.3329C21.5165 16.2576 20.283 16.6707 17.8168 17.496C17.561 20.084 17.4324 21.3779 16.6029 21.8993C16.4762 21.979 16.3409 22.0442 16.1996 22.0937C15.2748 22.4171 14.1824 21.7104 11.9994 20.2968C9.81658 21.7103 8.72506 22.4171 7.80021 22.0937C7.65874 22.0441 7.52282 21.9791 7.39592 21.8993C6.56669 21.3778 6.43883 20.0837 6.18303 17.496C3.71676 16.6707 2.48338 16.2576 2.15959 15.3329C2.11005 15.1914 2.07674 15.0444 2.05998 14.8954C1.95064 13.9218 2.88271 13.0146 4.7465 11.2011C3.8542 8.75861 3.40816 7.53759 3.92912 6.70791C4.00891 6.58086 4.10231 6.46241 4.20842 6.35635C4.9014 5.66383 6.19193 5.82775 8.77189 6.1542C10.1253 3.93342 10.8022 2.82269 11.7758 2.71279C11.9247 2.696 12.0751 2.69599 12.224 2.71279ZM11.9994 7.85732C9.23819 7.85754 6.99943 10.096 6.99943 12.8573C6.99959 15.6185 9.23829 17.8571 11.9994 17.8573C14.7608 17.8573 16.9993 15.6186 16.9994 12.8573C16.9994 10.0959 14.7609 7.85732 11.9994 7.85732Z" fill="currentColor"/></svg></span> Dark mode désactivé',
        musicMuted: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.44336 3.92188C10.1406 3.71986 10.8927 3.91175 11.4082 4.42285C11.9997 5.00957 12 6.84976 12 10.5293V13.4697C12 17.1496 11.9997 18.9894 11.4082 19.5762C10.8927 20.0875 10.1408 20.2792 9.44336 20.0772C8.71927 19.8672 7.92887 18.5249 6.47949 15.8779C6.18343 15.3372 5.61645 15 5 15C4.06812 15 3.60192 14.9999 3.23438 14.8477C2.74455 14.6447 2.35536 14.2554 2.15234 13.7656C2.00012 13.3981 2 12.9317 2 12C2 11.0681 2.0001 10.6019 2.15234 10.2344C2.3553 9.74447 2.7445 9.35536 3.23438 9.15235C3.60192 9.00011 4.06812 9 5 9C5.61645 9 6.18344 8.66278 6.47949 8.12207C7.92896 5.47474 8.71923 4.1317 9.44336 3.92188Z" fill="currentColor"/></svg></span> Musique coupée',
        musicOn: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.44336 3.92188C10.1406 3.71986 10.8927 3.91175 11.4082 4.42285C11.9997 5.00957 12 6.84976 12 10.5293V13.4697C12 17.1496 11.9997 18.9894 11.4082 19.5762C10.8927 20.0875 10.1408 20.2792 9.44336 20.0772C8.71927 19.8672 7.92887 18.5249 6.47949 15.8779C6.18343 15.3372 5.61645 15 5 15C4.06812 15 3.60192 14.9999 3.23438 14.8477C2.74455 14.6447 2.35536 14.2554 2.15234 13.7656C2.00012 13.3981 2 12.9317 2 12C2 11.0681 2.0001 10.6019 2.15234 10.2344C2.3553 9.74447 2.7445 9.35536 3.23438 9.15235C3.60192 9.00011 4.06812 9 5 9C5.61645 9 6.18344 8.66278 6.47949 8.12207C7.92896 5.47474 8.71923 4.1317 9.44336 3.92188Z" fill="currentColor"/><path d="M18.2559 4.9961C18.8105 4.585 19.5928 4.70126 20.0039 5.25586C21.4153 7.16 22.25 9.4866 22.25 12C22.25 14.5134 21.4153 16.84 20.0039 18.7441C19.5928 19.2987 18.8104 19.4149 18.2559 19.0039C17.7013 18.5928 17.5851 17.8105 17.9961 17.2559C19.106 15.7585 19.75 13.9483 19.75 12C19.75 10.0517 19.106 8.24148 17.9961 6.74414C17.585 6.18955 17.7013 5.40721 18.2559 4.9961Z" fill="currentColor"/><path d="M14.2559 7.9961C14.8105 7.585 15.5928 7.70126 16.0039 8.25586C16.785 9.30963 17.25 10.602 17.25 12C17.25 13.398 16.785 14.6904 16.0039 15.7441C15.5928 16.2987 14.8104 16.4149 14.2559 16.0039C13.7013 15.5928 13.5851 14.8105 13.9961 14.2559C14.4756 13.6089 14.75 12.8328 14.75 12C14.75 11.1672 14.4756 10.3911 13.9961 9.74414C13.585 9.18955 13.7013 8.40721 14.2559 7.9961Z" fill="currentColor"/></svg></span> Musique activée',
        langFr: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM4.73926 9C4.6407 9 4.55559 9.06709 4.52056 9.15921C4.18489 10.0421 4 10.9994 4 12C4 16.4183 7.58172 20 12 20C12.5088 20 13 19.6719 13 19.1631C12.9998 18.149 12.1772 17.3271 11.1631 17.3271H8.82617C8.24987 17.3271 7.78223 16.8595 7.78223 16.2832C7.78238 15.707 8.24997 15.2402 8.82617 15.2402H8.86914C9.46936 15.2402 9.9559 14.7535 9.95605 14.1533V13.6436C9.95605 12.7619 9.24192 12.0471 8.36035 12.0469H8.00195C7.16056 12.0469 6.47852 11.3648 6.47852 10.5234C6.47849 9.68216 5.79632 9.00016 4.95508 9H4.73926ZM12.5176 7.22559C12.1868 7.54639 12 7.98745 12 8.44824C12 9.38888 12.7625 10.1513 13.7031 10.1514H15.5762C16.9149 10.1516 18 11.2374 18 12.5762V13.5C18 13.7937 18.0844 14.0672 18.2303 14.2981C18.687 15.021 19.6577 14.4662 19.8323 13.629C19.942 13.1032 20 12.5584 20 12C20 9.1841 18.5448 6.7087 16.3457 5.28326C15.667 4.84332 14.7905 5.02052 14.2099 5.58373L12.5176 7.22559Z" fill="currentColor"/></svg></span> Langue FR',
        langEn: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM4.73926 9C4.6407 9 4.55559 9.06709 4.52056 9.15921C4.18489 10.0421 4 10.9994 4 12C4 16.4183 7.58172 20 12 20C12.5088 20 13 19.6719 13 19.1631C12.9998 18.149 12.1772 17.3271 11.1631 17.3271H8.82617C8.24987 17.3271 7.78223 16.8595 7.78223 16.2832C7.78238 15.707 8.24997 15.2402 8.82617 15.2402H8.86914C9.46936 15.2402 9.9559 14.7535 9.95605 14.1533V13.6436C9.95605 12.7619 9.24192 12.0471 8.36035 12.0469H8.00195C7.16056 12.0469 6.47852 11.3648 6.47852 10.5234C6.47849 9.68216 5.79632 9.00016 4.95508 9H4.73926ZM12.5176 7.22559C12.1868 7.54639 12 7.98745 12 8.44824C12 9.38888 12.7625 10.1513 13.7031 10.1514H15.5762C16.9149 10.1516 18 11.2374 18 12.5762V13.5C18 13.7937 18.0844 14.0672 18.2303 14.2981C18.687 15.021 19.6577 14.4662 19.8323 13.629C19.942 13.1032 20 12.5584 20 12C20 9.1841 18.5448 6.7087 16.3457 5.28326C15.667 4.84332 14.7905 5.02052 14.2099 5.58373L12.5176 7.22559Z" fill="currentColor"/></svg></span> Langue EN',
        dayNames: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    },
    en: {
        noData: 'No data',
        darkOn: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 3.85718C11.7891 3.85718 12.0004 5.04248 11.4641 5.62132C10.5555 6.60206 10 7.91462 10 9.35718C10 12.3947 12.4624 14.8572 15.5 14.8572C16.9423 14.8572 18.2542 14.3018 19.2346 13.3934C19.8136 12.8568 20.9996 13.0677 21 13.8572C21.0027 18.8277 16.9706 21.8572 12 21.8572C7.02944 21.8572 3 17.8277 3 12.8572C3 7.88661 6.02944 3.85718 11 3.85718Z" fill="currentColor"/></svg></span> Dark mode on',
        darkOff: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 12.8572C15 14.514 13.6569 15.8572 12 15.8572C10.3431 15.8572 9 14.514 9 12.8572C9 11.2003 10.3431 9.85718 12 9.85718C13.6569 9.85718 15 11.2003 15 12.8572Z" fill="currentColor"/><path d="M11.9994 9.85732C13.6563 9.85732 14.9994 11.2005 14.9994 12.8573C14.9993 14.514 13.6562 15.8573 11.9994 15.8573C10.3429 15.8571 8.99959 14.5139 8.99943 12.8573C8.99943 11.2006 10.3428 9.85754 11.9994 9.85732Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12.224 2.71279C13.1976 2.82269 13.8745 3.93342 15.2279 6.1542C17.808 5.82774 19.0985 5.66373 19.7914 6.35635C19.8975 6.46241 19.9909 6.58086 20.0707 6.70791C20.5916 7.53758 20.1456 8.75872 19.2533 11.2011C21.1171 13.0146 22.0492 13.9219 21.9399 14.8954C21.9231 15.0444 21.8898 15.1914 21.8403 15.3329C21.5165 16.2576 20.283 16.6707 17.8168 17.496C17.561 20.084 17.4324 21.3779 16.6029 21.8993C16.4762 21.979 16.3409 22.0442 16.1996 22.0937C15.2748 22.4171 14.1824 21.7104 11.9994 20.2968C9.81658 21.7103 8.72506 22.4171 7.80021 22.0937C7.65874 22.0441 7.52282 21.9791 7.39592 21.8993C6.56669 21.3778 6.43883 20.0837 6.18303 17.496C3.71676 16.6707 2.48338 16.2576 2.15959 15.3329C2.11005 15.1914 2.07674 15.0444 2.05998 14.8954C1.95064 13.9218 2.88271 13.0146 4.7465 11.2011C3.8542 8.75861 3.40816 7.53759 3.92912 6.70791C4.00891 6.58086 4.10231 6.46241 4.20842 6.35635C4.9014 5.66383 6.19193 5.82775 8.77189 6.1542C10.1253 3.93342 10.8022 2.82269 11.7758 2.71279C11.9247 2.696 12.0751 2.69599 12.224 2.71279ZM11.9994 7.85732C9.23819 7.85754 6.99943 10.096 6.99943 12.8573C6.99959 15.6185 9.23829 17.8571 11.9994 17.8573C14.7608 17.8573 16.9993 15.6186 16.9994 12.8573C16.9994 10.0959 14.7609 7.85732 11.9994 7.85732Z" fill="currentColor"/></svg></span> Dark mode off',
        musicMuted: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.44336 3.92188C10.1406 3.71986 10.8927 3.91175 11.4082 4.42285C11.9997 5.00957 12 6.84976 12 10.5293V13.4697C12 17.1496 11.9997 18.9894 11.4082 19.5762C10.8927 20.0875 10.1408 20.2792 9.44336 20.0772C8.71927 19.8672 7.92887 18.5249 6.47949 15.8779C6.18343 15.3372 5.61645 15 5 15C4.06812 15 3.60192 14.9999 3.23438 14.8477C2.74455 14.6447 2.35536 14.2554 2.15234 13.7656C2.00012 13.3981 2 12.9317 2 12C2 11.0681 2.0001 10.6019 2.15234 10.2344C2.3553 9.74447 2.7445 9.35536 3.23438 9.15235C3.60192 9.00011 4.06812 9 5 9C5.61645 9 6.18344 8.66278 6.47949 8.12207C7.92896 5.47474 8.71923 4.1317 9.44336 3.92188Z" fill="currentColor"/></svg></span> Music muted',
        musicOn: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.44336 3.92188C10.1406 3.71986 10.8927 3.91175 11.4082 4.42285C11.9997 5.00957 12 6.84976 12 10.5293V13.4697C12 17.1496 11.9997 18.9894 11.4082 19.5762C10.8927 20.0875 10.1408 20.2792 9.44336 20.0772C8.71927 19.8672 7.92887 18.5249 6.47949 15.8779C6.18343 15.3372 5.61645 15 5 15C4.06812 15 3.60192 14.9999 3.23438 14.8477C2.74455 14.6447 2.35536 14.2554 2.15234 13.7656C2.00012 13.3981 2 12.9317 2 12C2 11.0681 2.0001 10.6019 2.15234 10.2344C2.3553 9.74447 2.7445 9.35536 3.23438 9.15235C3.60192 9.00011 4.06812 9 5 9C5.61645 9 6.18344 8.66278 6.47949 8.12207C7.92896 5.47474 8.71923 4.1317 9.44336 3.92188Z" fill="currentColor"/><path d="M18.2559 4.9961C18.8105 4.585 19.5928 4.70126 20.0039 5.25586C21.4153 7.16 22.25 9.4866 22.25 12C22.25 14.5134 21.4153 16.84 20.0039 18.7441C19.5928 19.2987 18.8104 19.4149 18.2559 19.0039C17.7013 18.5928 17.5851 17.8105 17.9961 17.2559C19.106 15.7585 19.75 13.9483 19.75 12C19.75 10.0517 19.106 8.24148 17.9961 6.74414C17.585 6.18955 17.7013 5.40721 18.2559 4.9961Z" fill="currentColor"/><path d="M14.2559 7.9961C14.8105 7.585 15.5928 7.70126 16.0039 8.25586C16.785 9.30963 17.25 10.602 17.25 12C17.25 13.398 16.785 14.6904 16.0039 15.7441C15.5928 16.2987 14.8104 16.4149 14.2559 16.0039C13.7013 15.5928 13.5851 14.8105 13.9961 14.2559C14.4756 13.6089 14.75 12.8328 14.75 12C14.75 11.1672 14.4756 10.3911 13.9961 9.74414C13.585 9.18955 13.7013 8.40721 14.2559 7.9961Z" fill="currentColor"/></svg></span> Music on',
        langFr: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM4.73926 9C4.6407 9 4.55559 9.06709 4.52056 9.15921C4.18489 10.0421 4 10.9994 4 12C4 16.4183 7.58172 20 12 20C12.5088 20 13 19.6719 13 19.1631C12.9998 18.149 12.1772 17.3271 11.1631 17.3271H8.82617C8.24987 17.3271 7.78223 16.8595 7.78223 16.2832C7.78238 15.707 8.24997 15.2402 8.82617 15.2402H8.86914C9.46936 15.2402 9.9559 14.7535 9.95605 14.1533V13.6436C9.95605 12.7619 9.24192 12.0471 8.36035 12.0469H8.00195C7.16056 12.0469 6.47852 11.3648 6.47852 10.5234C6.47849 9.68216 5.79632 9.00016 4.95508 9H4.73926ZM12.5176 7.22559C12.1868 7.54639 12 7.98745 12 8.44824C12 9.38888 12.7625 10.1513 13.7031 10.1514H15.5762C16.9149 10.1516 18 11.2374 18 12.5762V13.5C18 13.7937 18.0844 14.0672 18.2303 14.2981C18.687 15.021 19.6577 14.4662 19.8323 13.629C19.942 13.1032 20 12.5584 20 12C20 9.1841 18.5448 6.7087 16.3457 5.28326C15.667 4.84332 14.7905 5.02052 14.2099 5.58373L12.5176 7.22559Z" fill="currentColor"/></svg></span> French',
        langEn: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM4.73926 9C4.6407 9 4.55559 9.06709 4.52056 9.15921C4.18489 10.0421 4 10.9994 4 12C4 16.4183 7.58172 20 12 20C12.5088 20 13 19.6719 13 19.1631C12.9998 18.149 12.1772 17.3271 11.1631 17.3271H8.82617C8.24987 17.3271 7.78223 16.8595 7.78223 16.2832C7.78238 15.707 8.24997 15.2402 8.82617 15.2402H8.86914C9.46936 15.2402 9.9559 14.7535 9.95605 14.1533V13.6436C9.95605 12.7619 9.24192 12.0471 8.36035 12.0469H8.00195C7.16056 12.0469 6.47852 11.3648 6.47852 10.5234C6.47849 9.68216 5.79632 9.00016 4.95508 9H4.73926ZM12.5176 7.22559C12.1868 7.54639 12 7.98745 12 8.44824C12 9.38888 12.7625 10.1513 13.7031 10.1514H15.5762C16.9149 10.1516 18 11.2374 18 12.5762V13.5C18 13.7937 18.0844 14.0672 18.2303 14.2981C18.687 15.021 19.6577 14.4662 19.8323 13.629C19.942 13.1032 20 12.5584 20 12C20 9.1841 18.5448 6.7087 16.3457 5.28326C15.667 4.84332 14.7905 5.02052 14.2099 5.58373L12.5176 7.22559Z" fill="currentColor"/></svg></span> English',
        dayNames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    }
};

function d(key) {
    return (DYN[currentLang] || DYN.fr)[key];
}

// Échappe le HTML des valeurs venant de la base (pseudo, nom de chaîne...)
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── Pseudos admin en rouge (liste servie par la base, pseudos réservés côté serveur) ── */
const ADMIN_NAMES = new Set();
function markAdmins(root = document) {
    root.querySelectorAll('.lb-pseudo').forEach(el => el.classList.toggle('lb-admin', ADMIN_NAMES.has(el.textContent.trim().toLowerCase())));
}
sbFetch('rpc/public_admins', { body: '{}' }).then(r => r.json()).then(rows => {
    (Array.isArray(rows) ? rows : []).forEach(a => a.pseudo && ADMIN_NAMES.add(a.pseudo.toLowerCase()));
    markAdmins();
    new MutationObserver(() => markAdmins()).observe(document.body, { childList: true, subtree: true });
}).catch(() => {});

/* ── Fetch stats ── */
async function fetchLeaderboard() {
    const r = await sbFetch('rpc/get_blackjack_leaderboard', { body: '{}' });
    return r.json();
}

async function fetchGameLeaderboard(fn) {
    try {
        const r = await sbFetch('rpc/' + fn, { body: '{}' });
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
    } catch { return []; }
}

async function fetchStats() {
    const r = await sbFetch('rpc/get_stats_summary', { body: '{}' });
    return r.json();
}

/* ── Render visits ── */
function renderVisits(data) {
    const fmt = n => Number(n || 0).toLocaleString('fr-FR');
    setVal('val-total', fmt(data.total_visits));
    setVal('val-today', fmt(data.today_visits));
    setVal('val-week',  fmt(data.week_visits));
    setVal('val-month', fmt(data.month_visits));
}

/* ── Bar chart 7 jours ── */
function renderBarChart(dailyChart) {
    const el = document.getElementById('bar-chart');
    if (!el) return;

    // Build a map date→count for last 7 days
    const map = {};
    (dailyChart || []).forEach(row => { map[row.date] = row.count; });

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d);
    }

    const maxCount = Math.max(1, ...days.map(d => map[d.toISOString().slice(0, 10)] || 0));

    el.innerHTML = days.map(day => {
        const key   = day.toISOString().slice(0, 10);
        const count = map[key] || 0;
        const pct   = Math.round((count / maxCount) * 100);
        const label = DYN[currentLang].dayNames[day.getDay()];
        return `
            <div class="bar-col">
                <div class="bar-count">${count || ''}</div>
                <div class="bar-fill" style="height:${Math.max(pct, 2)}%"></div>
                <div class="bar-label">${label}</div>
            </div>`;
    }).join('');
}

/* ── Channel ranking ── */
function renderChannelRanking(clicks) {
    const el = document.getElementById('channel-ranking');
    if (!el) return;

    const list = (clicks || []).slice(0, 8);
    if (!list.length) { el.innerHTML = `<p style="color:var(--muted);font-size:.8rem">${d('noData')}</p>`; return; }

    const max = list[0].count;
    const medals = ['gold', 'silver', 'bronze'];

    el.innerHTML = list.map((item, i) => {
        const pct  = Math.round((item.count / max) * 100);
        const cls  = medals[i] || '';
        return `
            <div class="rank-item">
                <span class="rank-num ${cls}">${i + 1}</span>
                <span class="rank-name">${esc(item.channel)}</span>
                <div class="rank-bar-wrap"><div class="rank-bar-fill" style="width:${pct}%"></div></div>
                <span class="rank-count">${Number(item.count) || 0}</span>
            </div>`;
    }).join('');
}

/* ── Prefs ── */
function renderPrefs(prefs) {
    const el = document.getElementById('prefs-list');
    if (!el) return;

    const map = {};
    (prefs || []).forEach(p => { map[p.event] = Number(p.count); });

    const darkTotal = (map['dark_mode_on'] || 0) + (map['dark_mode_off'] || 0);
    const musicTotal = (map['music_muted'] || 0) + (map['music_unmuted'] || 0);
    const langTotal = (map['lang_fr'] || 0) + (map['lang_en'] || 0);

    const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;

    const rows = [
        {
            label: d('darkOn'),
            pct: pct(map['dark_mode_on'] || 0, darkTotal),
            color: 'purple',
            val: map['dark_mode_on'] || 0
        },
        {
            label: d('musicMuted'),
            pct: pct(map['music_muted'] || 0, musicTotal),
            color: 'cyan',
            val: map['music_muted'] || 0
        },
        {
            label: d('langEn'),
            pct: pct(map['lang_en'] || 0, langTotal),
            color: 'green',
            val: map['lang_en'] || 0
        }
    ];

    if (!darkTotal && !musicTotal && !langTotal) {
        el.innerHTML = `<p style="color:var(--muted);font-size:.8rem">${d('noData')}</p>`;
        return;
    }

    el.innerHTML = rows.map(row => `
        <div class="pref-item">
            <div class="pref-header">
                <span class="pref-label">${row.label}</span>
                <span class="pref-pct" style="color:var(--${row.color})">${row.pct}%</span>
            </div>
            <div class="pref-track"><div class="pref-fill ${row.color}" style="width:${row.pct}%"></div></div>
        </div>`).join('');
}

/* ── Leaderboard ── */
function renderLeaderboard(rows) {
    const el = document.getElementById('leaderboard-list');
    if (!el) return;
    if (!rows || !rows.length) {
        el.innerHTML = `<p style="color:var(--muted);font-size:.8rem;text-align:center">${d('lb.empty') || 'Aucune session.'}</p>`;
        return;
    }
    const medals = ['<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 1', '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 2', '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 3'];
    const colorBankroll = n => n >= 1000 ? 'var(--green)' : n >= 500 ? 'var(--orange)' : '#f87171';
    el.innerHTML = `
        <table class="lb-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>${d('lb.pseudo') || 'Pseudo'}</th>
                    <th>${d('lb.bankroll') || 'Solde'}</th>
                    <th>${d('lb.hands') || 'Mains'}</th>
                    <th>${d('lb.date') || 'Date'}</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row, i) => `
                    <tr class="${i < 3 ? 'lb-top' : ''}">
                        <td class="lb-rank">${medals[i] || (i + 1)}</td>
                        <td class="lb-pseudo">${esc(row.pseudo)}</td>
                        <td class="lb-bankroll" style="color:${colorBankroll(row.bankroll)}">${Number(row.bankroll).toLocaleString('fr-FR')} €</td>
                        <td class="lb-hands">${esc(row.hands)}</td>
                        <td class="lb-date">${esc(row.date)}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

/* ── Blackjack ── */
function renderBlackjack(data) {
    const sign = n => n > 0 ? `+${n}€` : `${n}€`;
    const color = n => n >= 0 ? 'var(--green)' : '#f87171';

    setVal('bj-sessions', Number(data.bj_sessions || 0).toLocaleString('fr-FR'));
    setVal('bj-hands',    Number(data.bj_total_hands || 0).toLocaleString('fr-FR'));
    setValColored('bj-avg',  sign(data.bj_avg_net  || 0), color(data.bj_avg_net  || 0));
    setValColored('bj-best', sign(data.bj_best  || 0), color(data.bj_best  || 0));
    const fmt = n => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    const dd = Number(data.bj_max_drawdown || 0);
    setValColored('bj-peak', `${fmt(data.bj_peak)}€`, 'var(--green)');
    setValColored('bj-drawdown', dd > 0 ? `-${fmt(dd)}€` : '0€', dd > 0 ? '#f87171' : 'var(--green)');
    setVal('bj-credit', `${fmt(data.bj_total_credit)}€`);
    setVal('bj-bj',  Number(data.bj_total_bj || 0).toLocaleString('fr-FR'));
}

/* ── Roulette ── */
function renderRoulette(data) {
    const n = v => Number(v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    const sign = v => (v > 0 ? '+' : '') + n(v) + '€';
    const color = v => v >= 0 ? 'var(--green)' : '#f87171';
    const spins = Number(data.ro_spins || 0);
    const pct = v => spins ? ` (${Math.round(100 * Number(v || 0) / spins)}%)` : '';
    setVal('ro-sessions', n(data.ro_sessions));
    setVal('ro-spins', n(spins));
    setVal('ro-wagered', n(data.ro_wagered) + '€');
    setValColored('ro-avg', sign(Number(data.ro_avg_net || 0)), color(Number(data.ro_avg_net || 0)));
    setValColored('ro-best', sign(Number(data.ro_best || 0)), color(Number(data.ro_best || 0)));
    setVal('ro-red', n(data.ro_red) + pct(data.ro_red));
    setVal('ro-black', n(data.ro_black) + pct(data.ro_black));
    setVal('ro-zero', n(data.ro_zero) + pct(data.ro_zero));
}

/* ── Monopoly ── */
function renderMonopoly(data) {
    const n = v => Number(v || 0).toLocaleString('fr-FR');
    ['games', 'turns', 'players', 'bots', 'props', 'hotels', 'trades', 'bankrupt']
        .forEach(k => setVal('mo-' + k, n(data['mo_' + k])));
}

/* ── Loup-garou ── */
function renderWerewolf(data) {
    const n = v => Number(v || 0).toLocaleString('fr-FR');
    ['games', 'players', 'nights', 'village', 'wolves', 'votes', 'kills'].forEach(k => setVal('ww-' + k, n(data['ww_' + k])));
    setVal('ww-avg', n(data.ww_avg_minutes) + ' min');
}

/* ── UNO ── */
function renderUno(data) {
    const n = v => Number(v || 0).toLocaleString('fr-FR');
    ['games', 'players', 'rounds', 'turns', 'specials', 'challenges', 'catches'].forEach(k => setVal('un-' + k, n(data['un_' + k])));
    setVal('un-avg', n(data.un_avg_minutes) + ' min');
}

/* ── Buckshot (résumé et classement dans leurs propres RPC) ── */
async function loadBuckshot() {
    const n = v => Number(v || 0).toLocaleString('fr-FR');
    try {
        const r = await sbFetch('rpc/get_buckshot_summary', { body: '{}' });
        const s = await r.json();
        ['games', 'players', 'rounds', 'shots', 'hits', 'items'].forEach(k => setVal('bs-' + k, n(s[k])));
        setVal('bs-blanks', n(s.self_blanks));
        setVal('bs-avg', n(s.avg_minutes) + ' min');
    } catch (e) { console.warn('buckshot stats', e); }
    const rows = await fetchGameLeaderboard('get_buckshot_leaderboard');
    renderGameLeaderboard('bs', rows, [
        { label: d('lb.pseudo') || 'Pseudo', cls: 'lb-pseudo', render: r => esc(r.pseudo) },
        { label: 'Victoires', cls: 'lb-bankroll', style: () => 'color:var(--green)', render: r => n(r.wins) },
        { label: 'Parties', cls: 'lb-hands', render: r => n(r.games) },
        { label: d('lb.date') || 'Date', cls: 'lb-date', render: r => esc(r.date) },
    ]);
}

/* ── Mille Bornes, Petits Chevaux, Bataille navale, Puissance 4, TrackMerdia : résumé + classement dans leurs propres RPC ── */
const SUMMARY_GAMES = {"mb": {"summary": "get_milleborne_summary", "lb": "get_milleborne_leaderboard", "cards": [["games", "games", ""], ["players", "players", ""], ["rounds", "rounds", ""], ["avg", "avg_minutes", " min"], ["km", "km", " km"], ["hazards", "hazards", ""], ["coups", "coups", ""], ["teams", "team_games", ""]]}, "hc": {"summary": "get_horses_summary", "lb": "get_horses_leaderboard", "cards": [["games", "games", ""], ["players", "players", ""], ["rolls", "rolls", ""], ["avg", "avg_minutes", " min"], ["sixes", "sixes", ""], ["moves", "moves", ""], ["captures", "captures", ""], ["botwins", "bot_wins", ""]]}, "nv": {"summary": "get_naval_summary", "lb": "get_naval_leaderboard", "cards": [["games", "games", ""], ["players", "players", ""], ["shots", "shots", ""], ["avg", "avg_minutes", " min"], ["hits", "hits", ""], ["accuracy", "accuracy", " %"], ["vsbot", "vs_bot", ""], ["botwins", "bot_wins", ""]]}, "c4": {"summary": "get_connect4_summary", "lb": "get_connect4_leaderboard", "cards": [["games", "games", ""], ["players", "players", ""], ["rounds", "rounds", ""], ["avg", "avg_minutes", " min"], ["moves", "moves", ""], ["draws", "draws", ""], ["vsbot", "vs_bot", ""], ["botwins", "bot_wins", ""]]}, "tr": {"summary": "get_racing_summary", "lb": "get_racing_leaderboard", "cards": [["records", "records", ""], ["players", "players", ""], ["attempts", "attempts", ""], ["played", "played_maps", ""], ["maps", "maps", ""], ["best", "best_ms", "time"]]}};

function fmtRaceTime(ms) {
    if (!ms) return '-';
    const m = Math.floor(ms / 60000), sec = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
    return m ? `${m}:${sec}` : `${(ms / 1000).toFixed(3)} s`;
}

async function loadSummaryGame(panel) {
    const g = SUMMARY_GAMES[panel];
    const n = v => Number(v || 0).toLocaleString('fr-FR');
    try {
        const r = await sbFetch('rpc/' + g.summary, { body: '{}' });
        const s = await r.json();
        g.cards.forEach(([id, key, suffix]) => setVal(`${panel}-${id}`, suffix === 'time' ? fmtRaceTime(s[key]) : n(s[key]) + suffix));
    } catch (e) { console.warn(panel + ' stats', e); }
    const rows = await fetchGameLeaderboard(g.lb);
    // TrackMerdia : classement au nombre de 1res places, puis 2es, puis 3es (trié côté base)
    if (panel === 'tr') {
        renderGameLeaderboard(panel, rows, [
            { label: d('lb.pseudo') || 'Pseudo', cls: 'lb-pseudo', render: r => esc(r.pseudo) },
            { label: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 1er', cls: 'lb-bankroll', style: () => 'color:var(--green)', render: r => n(r.wins) },
            { label: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 2e', cls: 'lb-hands', render: r => n(r.p2) },
            { label: '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 3e', cls: 'lb-hands', render: r => n(r.p3) },
            { label: 'Pistes', cls: 'lb-hands', render: r => n(r.games) },
            { label: d('lb.date') || 'Date', cls: 'lb-date', render: r => esc(r.date) },
        ]);
        return;
    }
    renderGameLeaderboard(panel, rows, [
        { label: d('lb.pseudo') || 'Pseudo', cls: 'lb-pseudo', render: r => esc(r.pseudo) },
        { label: panel === 'tr' ? 'Records' : 'Victoires', cls: 'lb-bankroll', style: () => 'color:var(--green)', render: r => n(r.wins) },
        { label: panel === 'tr' ? 'Pistes' : 'Parties', cls: 'lb-hands', render: r => n(r.games) },
        { label: d('lb.date') || 'Date', cls: 'lb-date', render: r => esc(r.date) },
    ]);
}

/* ── Leaderboards Roulette / Monopoly (même table que le blackjack) ── */
function renderGameLeaderboard(panel, rows, cols) {
    const el = document.querySelector(`.game-panel[data-panel="${panel}"] .leaderboard-list`);
    if (!el) return;
    if (!rows.length) {
        el.innerHTML = `<p class="lb-empty">${d('lb.empty') || 'Aucune session.'}</p>`;
        return;
    }
    const medals = ['<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 1', '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 2', '<span class="ic"><svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.82032 8.83999L6.25654 14.0434L12 17.68L17.7435 14.0434L16.1797 8.83999H7.82032Z" fill="currentColor"/><path d="M12 17.68C14.7225 20.2309 16.0837 21.5063 17.0809 21.3186C17.4986 21.2399 17.8805 21.0302 18.171 20.7198C18.8643 19.979 18.5182 18.146 17.8259 14.48L17.7435 14.0434L12 17.68Z" fill="currentColor"/><path d="M16.1797 8.83999L17.7435 14.0434C20.0495 12.9774 21.2026 12.4444 21.5049 12.0426C22.2419 11.0633 21.9327 9.65753 20.8528 9.07784C20.4098 8.83999 19.1395 8.83999 16.599 8.83999H16.1797Z" fill="currentColor"/><path d="M7.82032 8.83999H16.1797L15.6162 7.64815C14.0498 4.33535 13.2667 2.67896 12 2.67896C10.7333 2.67896 9.95018 4.33535 8.38384 7.64815L7.82032 8.83999Z" fill="currentColor"/><path d="M6.1741 14.48C5.48181 18.146 5.13567 19.979 5.829 20.7198C6.11951 21.0302 6.50136 21.2399 6.91915 21.3186C7.91626 21.5063 9.27751 20.2309 12 17.68L6.25654 14.0434L6.1741 14.48Z" fill="currentColor"/><path d="M6.25654 14.0434L7.82032 8.83999H7.40101C4.86049 8.83999 3.59024 8.83999 3.14716 9.07784C2.0673 9.65753 1.7581 11.0633 2.49508 12.0426C2.79746 12.4444 3.95049 12.9774 6.25654 14.0434Z" fill="currentColor"/></svg></span> 3'];
    el.innerHTML = `
        <table class="lb-table">
            <thead><tr><th>#</th>${cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
            <tbody>
                ${rows.map((row, i) => `
                    <tr class="${i < 3 ? 'lb-top' : ''}">
                        <td class="lb-rank">${medals[i] || (i + 1)}</td>
                        ${cols.map(c => `<td class="${c.cls || ''}"${c.style ? ` style="${c.style(row)}"` : ''}>${c.render(row)}</td>`).join('')}
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function renderGameLeaderboards(ro, mo, ww = [], un = []) {
    const n = v => Number(v || 0).toLocaleString('fr-FR');
    renderGameLeaderboard('ro', ro, [
        { label: d('lb.pseudo') || 'Pseudo', cls: 'lb-pseudo', render: r => esc(r.pseudo) },
        { label: 'Gain', cls: 'lb-bankroll', style: r => `color:${r.net >= 0 ? 'var(--green)' : '#f87171'}`, render: r => (r.net > 0 ? '+' : '') + n(r.net) + ' €' },
        { label: 'Tirages', cls: 'lb-hands', render: r => n(r.spins) },
        { label: d('lb.date') || 'Date', cls: 'lb-date', render: r => esc(r.date) },
    ]);
    renderGameLeaderboard('mo', mo, [
        { label: d('lb.pseudo') || 'Pseudo', cls: 'lb-pseudo', render: r => esc(r.pseudo) },
        { label: 'Victoires', cls: 'lb-bankroll', style: () => 'color:var(--green)', render: r => n(r.wins) },
        { label: d('lb.date') || 'Date', cls: 'lb-date', render: r => esc(r.date) },
    ]);
    renderGameLeaderboard('ww', ww, [
        { label: d('lb.pseudo') || 'Pseudo', cls: 'lb-pseudo', render: r => esc(r.pseudo) },
        { label: 'Victoires', cls: 'lb-bankroll', style: () => 'color:var(--green)', render: r => n(r.wins) },
        { label: 'Parties', cls: 'lb-hands', render: r => n(r.games) },
        { label: d('lb.date') || 'Date', cls: 'lb-date', render: r => esc(r.date) },
    ]);
    renderGameLeaderboard('un', un, [
        { label: d('lb.pseudo') || 'Pseudo', cls: 'lb-pseudo', render: r => esc(r.pseudo) },
        { label: 'Victoires', cls: 'lb-bankroll', style: () => 'color:var(--green)', render: r => n(r.wins) },
        { label: 'Parties', cls: 'lb-hands', render: r => n(r.games) },
        { label: d('lb.date') || 'Date', cls: 'lb-date', render: r => esc(r.date) },
    ]);
}

/* ── Helpers ── */
function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.classList.remove('loading'); }
}

function setValColored(id, val, color) {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.style.color = color; el.classList.remove('loading'); }
}

function setLoading() {
    ['val-total','val-today','val-week','val-month',
     'bj-sessions','bj-hands','bj-avg','bj-best','bj-peak','bj-drawdown','bj-bj','bj-credit'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '-'; el.classList.add('loading'); }
    });
}

/* ── Language hook (appelé par assets/lang-switcher.js une fois les traductions appliquées) ── */
function setLanguage(lang) {
    currentLang = lang;
    // Re-render dynamic parts with new lang
    if (window._lastStats) {
        renderBarChart(window._lastStats.daily_chart);
        renderChannelRanking(window._lastStats.channel_clicks);
        renderPrefs(window._lastStats.preferences);
        renderLeaderboard(window._lastLb || []);
    }
}

/* ── Init ── */
async function init() {
    setLoading();

    // Apply initial lang from localStorage
    const savedLang = localStorage.getItem('lang') || 'fr';
    if (savedLang !== 'fr') setLanguage(savedLang);

    try {
        const [data, lb, roLb, moLb, wwLb, unLb] = await Promise.all([
            fetchStats(), fetchLeaderboard(),
            fetchGameLeaderboard('get_roulette_leaderboard'), fetchGameLeaderboard('get_monopoly_leaderboard'),
            fetchGameLeaderboard('get_werewolf_leaderboard'), fetchGameLeaderboard('get_uno_leaderboard'),
        ]);
        window._lastStats = data;
        window._lastLb    = lb;
        renderVisits(data);
        renderBarChart(data.daily_chart);
        renderChannelRanking(data.channel_clicks);
        renderPrefs(data.preferences);
        renderBlackjack(data);
        renderRoulette(data);
        renderMonopoly(data);
        renderWerewolf(data);
        renderUno(data);
        renderLeaderboard(Array.isArray(lb) ? lb : []);
        renderGameLeaderboards(roLb, moLb, wwLb, unLb);
    } catch (e) {
        console.error('Stats fetch error:', e);
        ['val-total','val-today','val-week','val-month'].forEach(id => setVal(id, '?'));
    }
}

/* ── Onglets jeux ── */
function initGameTabs() {
    const tabs = document.querySelectorAll('.game-tab');
    const show = g => {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.game === g));
        document.querySelectorAll('.game-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === g));
        try { localStorage.setItem('statsGame', g); } catch (e) {}
    };
    tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.game)));
    let saved = null;
    try { saved = localStorage.getItem('statsGame'); } catch (e) {}
    if (saved && document.querySelector(`.game-tab[data-game="${saved}"]`)) show(saved);
}

initGameTabs();
init();
loadBuckshot();
Object.keys(SUMMARY_GAMES).forEach(loadSummaryGame);
