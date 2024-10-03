addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
})

// 配置区
const ACCOUNT = {
  user: "admin",       // 初始用户名
  password: "admin123" // 初始密码
};

const SITE_CONFIG = {
  siteTitle: "My Blog",
  siteIcon: "https://example.com/favicon.ico"
}

// 处理请求
async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/admin')) {
    return handleAdminRequest(request);
  } else if (url.pathname === '/search') {
    return handleSearch(request);
  } else if (url.pathname === '/') {
    return renderHomePage();
  } else {
    return new Response('Page Not Found', { status: 404 });
  }
}

// 处理后台请求
async function handleAdminRequest(request) {
  if (!parseBasicAuth(request)) {
    return new Response('Unauthorized', {
      headers: { 'WWW-Authenticate': 'Basic realm="Admin Area"' },
      status: 401
    });
  }

  const url = new URL(request.url);

  // 保存文章
  if (url.pathname === '/admin/saveArticle') {
    const formData = await request.formData();
    const article = {
      title: formData.get('title'),
      content: formData.get('content'),
      img: formData.get('img'),
      createDate: new Date().toISOString(),
    };
    const id = await generateArticleId();
    await saveArticle(id, article);
    return new Response('Article saved', { status: 200 });
  }

  // 更新网站配置
  if (url.pathname === '/admin/updateConfig') {
    const formData = await request.formData();
    SITE_CONFIG.siteTitle = formData.get('siteTitle');
    SITE_CONFIG.siteIcon = formData.get('siteIcon');
    return new Response('Config updated', { status: 200 });
  }

  // 更新账户
  if (url.pathname === '/admin/updateAccount') {
    const formData = await request.formData();
    ACCOUNT.user = formData.get('user');
    ACCOUNT.password = formData.get('password');
    return new Response('Account updated', { status: 200 });
  }

  // 渲染后台页面
  return renderAdminPage();
}

// 基本身份验证
function parseBasicAuth(request) {
  const auth = request.headers.get("Authorization");
  if (!auth || !/^Basic [A-Za-z0-9._~+/-]+=*$/i.test(auth)) {
    return false;
  }
  const [user, pwd] = atob(auth.split(" ").pop()).split(":");
  return user === ACCOUNT.user && pwd === ACCOUNT.password;
}

// 保存文章
async function saveArticle(id, article) {
  await BLOG_KV.put(id, JSON.stringify(article));
}

// 获取文章
async function getArticle(id) {
  const article = await BLOG_KV.get(id);
  return JSON.parse(article);
}

// 生成唯一文章 ID
async function generateArticleId() {
  const articles = await BLOG_KV.list();
  const newId = (articles.keys.length + 1).toString().padStart(6, '0');
  return newId;
}

// 搜索文章
async function searchPosts(query) {
  const articles = await BLOG_KV.list();
  let results = [];
  
  for (const key of articles.keys) {
    const article = await getArticle(key.name);
    if (article.title.includes(query) || article.content.includes(query)) {
      results.push(article);
    }
  }
  
  return results;
}

// 渲染首页
async function renderHomePage() {
  const html = `
    <html>
      <head>
        <title>${SITE_CONFIG.siteTitle}</title>
        <link rel="icon" href="${SITE_CONFIG.siteIcon}" type="image/x-icon">
      </head>
      <body>
        <h1>Welcome to ${SITE_CONFIG.siteTitle}</h1>
        <form action="/search" method="get">
          <input type="text" name="q" placeholder="Search...">
        <button type="submit">Search</button>
      </form>
    </body>
    </html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

// 渲染后台管理页面
async function renderAdminPage() {
  const html = `
    <html>
      <body>
        <h1>Admin Panel</h1>
        <form action="/admin/saveArticle" method="post">
          <input type="text" name="title" placeholder="Article Title" required>
          <textarea name="content" placeholder="Article Content" required></textarea>
          <input type="text" name="img" placeholder="Image URL">
          <button type="submit">Save Article</button>
        </form>
        <form action="/admin/updateConfig" method="post">
          <input type="text" name="siteTitle" placeholder="Site Title" required>
          <input type="text" name="siteIcon" placeholder="Site Icon URL" required>
          <button type="submit">Update Config</button>
        </form>
        <form action="/admin/updateAccount" method="post">
          <input type="text" name="user" placeholder="New Username" required>
          <input type="password" name="password" placeholder="New Password" required>
          <button type="submit">Update Account</button>
        </form>
      </body>
    </html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

// 处理搜索请求
async function handleSearch(request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const results = await searchPosts(query);

  const html = `
    <html>
      <head>
        <title>Search Results</title>
      </head>
      <body>
        <h1>Search Results for "${query}"</h1>
        <ul>
          ${results.map(result => `<li><strong>${result.title}</strong><br>${result.content.substring(0, 100)}...<br><img src="${result.img}" alt="${result.title}" width="100"></li>`).join('')}
        </ul>
        <a href="/">Back to Home</a>
      </body>
    </html>`;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}

// 启动 Workers 时的 KV 存储
const BLOG_KV = {
  put: async (key, value) => {
    // 在此添加 KV 存储逻辑
    await MY_KV_NAMESPACE.put(key, value);
  },
  get: async (key) => {
    return await MY_KV_NAMESPACE.get(key);
  },
  list: async () => {
    // 获取所有文章的 ID
    const keys = await MY_KV_NAMESPACE.list();
    return keys;
  }
};

// 部署时的 KV 名称空间
const MY_KV_NAMESPACE =CFBLOG /* 你的 KV 名称空间 */;