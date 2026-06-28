// ══════════════════════════════════════════════════════════════
// services/supabase.js
// Supabase Auth natif — plus de x-app-secret
// Les secrets sont injectés par GitHub Actions
// ══════════════════════════════════════════════════════════════

export let _sbClient    = null;
export let _fbConnected = false;
export let _fbUsersLoaded = false;

export function setClient(c)       { _sbClient = c; }
export function setConnected(v)    { _fbConnected = v; }
export function setUsersLoaded(v)  { _fbUsersLoaded = v; }

// ── Wrapper _sb ───────────────────────────────────────────────
export const _sb = {
  set(table, key, value) {
    if(!_sbClient) return Promise.resolve();
    const col = table==='hm_events' ? 'id'
              : table==='hm_completions' ? 'user_id' : 'key';
    return _sbClient.from(table)
      .upsert({[col]:key, data:value})
      .then(({error})=>{ if(error) console.warn('sb.set:',error.message); });
  },

  get(table, key) {
    if(!_sbClient) return Promise.resolve(null);
    const col = table==='hm_events' ? 'id'
              : table==='hm_completions' ? 'user_id' : 'key';
    return _sbClient.from(table).select('data').eq(col,key).maybeSingle()
      .then(({data,error})=>(error||!data)?null:data.data);
  },

  getAll(table) {
    if(!_sbClient) return Promise.resolve([]);
    return _sbClient.from(table).select('*')
      .then(({data,error})=>(error||!data)?[]:data);
  },

  on(table, cb) {
    if(!_sbClient) return null;
    return _sbClient.channel('rt:'+table)
      .on('postgres_changes',{event:'*',schema:'public',table},cb)
      .subscribe();
  }
};

// ── Config (injectée par GitHub Actions) ──────────────────────
export const DEFAULT_CONFIG = {
  projectUrl: '%%SUPABASE_URL%%',
  anonKey:    '%%SUPABASE_ANON_KEY%%'
};

export function loadFirebaseConfig() {
  try { return JSON.parse(localStorage.getItem('hm_sb_cfg')||'null'); }
  catch(e) { return null; }
}

export function persistFirebaseConfig(cfg) {
  localStorage.setItem('hm_sb_cfg', JSON.stringify(cfg));
}

// ── Initialisation Supabase Auth ──────────────────────────────
export async function initSupabase(cfg) {
  const client = supabase.createClient(cfg.projectUrl, cfg.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession:   true,
      detectSessionInUrl: false
    }
  });

  // Test de connexion
  const { error } = await client.from('hm_app_data').select('key').limit(1);
  if(error && error.code !== 'PGRST116') {
    // PGRST116 = table vide, pas une vraie erreur
    console.warn('Supabase connection warning:', error.message);
  }

  _sbClient    = client;
  _fbConnected = true;
  return client;
}
