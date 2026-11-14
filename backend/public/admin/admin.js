// Shared helpers for the Rocket Money admin panel (plain JS, no build step).
(function () {
  const TOKEN_KEY = 'rm_admin_token';
  const API = '/api/admin';

  const RM = (window.RM = {});
  RM.token = () => localStorage.getItem(TOKEN_KEY);
  RM.setToken = t => localStorage.setItem(TOKEN_KEY, t);
  RM.logout = () => { localStorage.removeItem(TOKEN_KEY); location.href = '/admin/login.html'; };

  RM.api = async function (path, options = {}) {
    const res = await fetch(API + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(RM.token() ? { Authorization: 'Bearer ' + RM.token() } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401 && path !== '/login') { RM.logout(); throw new Error('Session expired'); }
    if (!res.ok) {
      const msg = data && data.message ? (Array.isArray(data.message) ? data.message.join(', ') : data.message) : 'Request failed (' + res.status + ')';
      throw new Error(msg);
    }
    return data;
  };

  RM.money = v => '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  RM.date = v => (v ? new Date(v).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  RM.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  RM.name = u => (u ? RM.esc([u.firstName, u.lastName].filter(Boolean).join(' ')) + (u.username ? ' <span class="text-gray-500">@' + RM.esc(u.username) + '</span>' : '') : '—');

  RM.badge = function (status) {
    const colors = {
      PENDING: 'bg-yellow-500/15 text-yellow-400', PROCESSING: 'bg-blue-500/15 text-blue-400', APPROVED: 'bg-cyan-500/15 text-cyan-400',
      PAID: 'bg-[#00FF88]/15 text-[#00FF88]', COMPLETED: 'bg-[#00FF88]/15 text-[#00FF88]', REJECTED: 'bg-red-500/15 text-red-400',
      FAILED: 'bg-red-500/15 text-red-400', REVERSED: 'bg-gray-500/15 text-gray-300', BLOCKED: 'bg-red-500/15 text-red-400', ACTIVE: 'bg-[#00FF88]/15 text-[#00FF88]',
    };
    return '<span class="px-2 py-0.5 rounded-full text-xs font-semibold ' + (colors[status] || 'bg-gray-500/15 text-gray-300') + '">' + RM.esc(status) + '</span>';
  };

  RM.toast = function (msg, type = 'success') {
    const el = document.createElement('div');
    el.className = 'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ' +
      (type === 'error' ? 'bg-red-500/90 text-white' : 'bg-[#00FF88] text-black');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };

  RM.pager = function (container, data, onPage) {
    const el = document.getElementById(container);
    if (!el) return;
    const pages = Math.max(data.pages || 1, 1);
    el.innerHTML =
      '<span class="text-gray-500 text-sm">Page ' + data.page + ' of ' + pages + ' · ' + data.total + ' total</span>' +
      '<div class="flex gap-2"><button id="' + container + '-prev" class="btn-ghost" ' + (data.page <= 1 ? 'disabled' : '') + '>Prev</button>' +
      '<button id="' + container + '-next" class="btn-ghost" ' + (data.page >= pages ? 'disabled' : '') + '>Next</button></div>';
    document.getElementById(container + '-prev').onclick = () => onPage(data.page - 1);
    document.getElementById(container + '-next').onclick = () => onPage(data.page + 1);
  };

  const NAV = [
    ['index.html', 'Dashboard', 'M3 12l9-9 9 9M5 10v10h14V10'],
    ['users.html', 'Users', 'M17 20h5v-2a4 4 0 00-5-4M9 20H2v-2a4 4 0 015-4m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 2a3 3 0 11-6 0 3 3 0 016 0z'],
    ['withdrawals.html', 'Withdrawals', 'M12 8c-2 0-3 .9-3 2s1 2 3 2 3 .9 3 2-1 2-3 2m0-8V6m0 10v2M4 12a8 8 0 1016 0 8 8 0 00-16 0z'],
    ['transactions.html', 'Transactions', 'M4 6h16M4 12h16M4 18h10'],
    ['settings.html', 'Settings', 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14.4 3h-4l-.4 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.6l-2 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3l.4 2.4h4l.4-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z'],
  ];

  /** Guards the page and renders the sidebar. Call on every protected page. */
  RM.init = function (active) {
    if (!RM.token()) { location.href = '/admin/login.html'; return false; }
    const side = document.getElementById('sidebar');
    if (side) {
      side.innerHTML =
        '<div class="flex items-center gap-2 px-4 py-6"><span class="text-2xl">🚀</span><span class="font-bold text-lg">Rocket <span class="text-[#00FF88]">Admin</span></span></div>' +
        '<nav class="flex-1 px-2 space-y-1">' +
        NAV.map(([href, label, icon]) =>
          '<a href="/admin/' + href + '" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ' +
          (href === active ? 'bg-[#00FF88]/10 text-[#00FF88]' : 'text-gray-400 hover:bg-white/5 hover:text-white') + '">' +
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="' + icon + '"/></svg>' + label + '</a>').join('') +
        '</nav><div class="p-4"><button onclick="RM.logout()" class="w-full btn-ghost">Log out</button></div>';
    }
    return true;
  };
})();
