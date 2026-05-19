import Keycloak from 'keycloak-js'

// Em modo dev (VITE_BYPASS_AUTH=true) usa um mock que não precisa de servidor Keycloak
if (import.meta.env.VITE_BYPASS_AUTH === 'true') {
  console.warn('[Auth] MODO DEV — Keycloak desabilitado, usando bypass de autenticação.')
}

const keycloak: Keycloak = import.meta.env.VITE_BYPASS_AUTH === 'true'
  ? ({
      token: 'dev-bypass',
      tokenParsed: { preferred_username: 'admin', email: 'admin@dnlprojetos.com' },
      authenticated: true,
      init: () => Promise.resolve(true),
      updateToken: () => Promise.resolve(true),
      login: () => Promise.resolve(),
      logout: () => Promise.resolve(),
      accountManagement: () => { alert('[Dev] No modo dev o gerenciamento de conta não está disponível.') },
    } as unknown as Keycloak)
  : new Keycloak({
      url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
      realm: import.meta.env.VITE_KEYCLOAK_REALM || 'dnl',
      clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'dnl-web'
    })

export default keycloak
