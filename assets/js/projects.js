/**
 * 项目动态展示脚本
 * ==================
 * 作用：打开 /projects/ 页面时，自动从 GitHub 拉取 mrzhao-1 的公开仓库，
 *       按标签(topic)或名称/描述关键词自动分类展示。
 *
 * 展示规则：
 *   - 原创项目（自己写的仓库）和 fork 仓库（研究别人的开源项目）都会展示。
 *   - 每个分类内，原创项目排在前面，fork 排在后面。
 *
 * 分类依据（按优先级）：
 *   1. 仓库的 topic 标签（在 GitHub 仓库设置里打，最准）
 *   2. 仓库的名称/描述里的关键词（兜底，主要给没打标签的 fork 仓库用）
 *   → 分类规则定义在下方 CATEGORIES 数组。
 */
(function () {
  'use strict';

  var USERNAME = 'mrzhao-1';
  var SITE_REPO = USERNAME + '.github.io';
  var API_URL = 'https://api.github.com/users/' + USERNAME + '/repos?per_page=100&sort=updated';

  var container = document.getElementById('projects-container');
  var loading = document.getElementById('projects-loading');

  // 快照的原始数据，用来给实时接口的数据补字段（见 patchFromSnapshot）
  var snapshotRepos = null;

  // -------------------------------------------------------------
  // 分类规则：
  //   topics    —— 仓库 topic 标签里含这些词，就归入该分类（给原创项目用）
  //   keywords  —— 仓库名称或描述里含这些词，就归入该分类（给没打标签的 fork 仓库兜底）
  // 数组顺序就是匹配优先级，靠前的分类先匹配。
  // -------------------------------------------------------------
  var CATEGORIES = [
    {
      name: '云原生存储',
      desc: 'Kubernetes 存储、CSI、分布式存储方向',
      topics: ['csi', 'storage', 'kubernetes-storage', 'ceph', 'rook', 'volume', 'snapshot', 'cloud-native-storage', 'filesystem'],
      keywords: ['zfs', 'ceph', 'filesystem', 'volume', 'snapshot', 'csi', 's3', 'minio', 'filestash', 'nfs', 'iscsi', 'object-storage']
    },
    {
      name: '平台工程 / DevOps',
      desc: 'CI/CD、基础设施、容器与自动化方向',
      topics: ['devops', 'ci-cd', 'cicd', 'platform-engineering', 'infrastructure', 'jenkins', 'gitlab', 'terraform', 'docker', 'kubernetes', 'operator', 'automation', 'pipeline'],
      keywords: ['devops', 'deviops', 'ci-cd', 'cicd', 'jenkins', 'gitlab', 'svn', 'redmine', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'git', 'credential', 'juju', 'sandbox', 'dive', 'pipeline', 'orchestration', 'container']
    },
    {
      name: '学习与工具',
      desc: '学习记录、实验与辅助工具',
      topics: ['learning', 'tool', 'notes', 'demo', 'practice'],
      keywords: ['tool', 'vscode', 'browser', 'rsync', 'rsp', 'filebrowser', 'jekyll', 'theme', 'editor', 'static', 'binary', 'server']
    }
  ];
  var DEFAULT_CATEGORY = '其他';

  // 常用语言的圆点颜色（GitHub 配色），没列到的语言用灰色。
  var LANG_COLORS = {
    'Go': '#00ADD8', 'C': '#555555', 'Python': '#3572A5', 'Shell': '#89e051',
    'Ruby': '#701516', 'JavaScript': '#f1e05a', 'TypeScript': '#3178c6',
    'Java': '#b07219', 'Rust': '#dea584', 'C++': '#f34b7d', 'HTML': '#e34c26',
    'CSS': '#563d7c', 'YAML': '#cb171e', 'Dockerfile': '#384d54', 'Makefile': '#427819'
  };

  function getLangColor(lang) {
    return LANG_COLORS[lang] || '#888888';
  }

  function formatDate(iso) {
    if (!iso) return '';
    return iso.slice(0, 10);
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 给一个仓库判断分类（先 topic，再名称/描述关键词）
  function classify(repo) {
    var name = (repo.name || '').toLowerCase();
    var desc = (repo.description || '').toLowerCase();
    var topics = (repo.topics || []).map(function (t) { return t.toLowerCase(); });
    var haystack = name + ' ' + desc;

    for (var i = 0; i < CATEGORIES.length; i++) {
      var cat = CATEGORIES[i];
      var j;
      for (j = 0; j < cat.topics.length; j++) {
        if (topics.indexOf(cat.topics[j]) !== -1) return cat;
      }
      for (j = 0; j < cat.keywords.length; j++) {
        if (haystack.indexOf(cat.keywords[j]) !== -1) return cat;
      }
    }
    return { name: DEFAULT_CATEGORY, desc: '' };
  }

  // 渲染一张项目卡片
  function renderCard(repo) {
    var lang = repo.language || '';
    var langDot = lang
      ? '<span class="lang-dot" style="background:' + getLangColor(lang) + '"></span>' + escapeHtml(lang)
      : '';
    var stars = '★ ' + (repo.stargazers_count || 0);
    var updated = formatDate(repo.updated_at);
    return (
      '<div class="project-card">' +
        '<p class="name"><a href="' + escapeHtml(repo.html_url) + '" target="_blank" rel="noopener">' + escapeHtml(repo.name) + '</a></p>' +
        '<p class="desc">' + escapeHtml(repo.description || '暂无描述') + '</p>' +
        '<div class="meta">' +
          (langDot ? '<span>' + langDot + '</span>' : '') +
          '<span>' + stars + '</span>' +
          (updated ? '<span>更新于 ' + escapeHtml(updated) + '</span>' : '') +
        '</div>' +
      '</div>'
    );
  }

  // 渲染一个分类，原创排前、fork 排后
  function renderCategory(cat, repos) {
    if (!repos.length) return '';
    repos.sort(function (a, b) { return (a.fork ? 1 : 0) - (b.fork ? 1 : 0); });
    var cards = repos.map(renderCard).join('');
    return (
      '<div class="project-category">' +
        '<h2>' + escapeHtml(cat.name) + '</h2>' +
        (cat.desc ? '<div class="cat-desc">' + escapeHtml(cat.desc) + '</div>' : '') +
      '</div>' +
      '<div class="project-grid">' + cards + '</div>'
    );
  }

  function renderEmpty(message) {
    return '<div class="projects-note">' + escapeHtml(message) + '</div>';
  }

  // 把「一组仓库数据」渲染成页面，供快照和实时两路复用
  function renderRepos(repos) {
    if (!Array.isArray(repos)) {
      throw new Error((repos && repos.message) || '数据格式异常');
    }

    // 排除本站仓库本身，其余全部纳入展示
    var all = repos.filter(function (repo) {
      return repo.name !== SITE_REPO;
    });

    // 按分类分组
    var grouped = {};
    CATEGORIES.forEach(function (c) { grouped[c.name] = []; });
    grouped[DEFAULT_CATEGORY] = [];
    all.forEach(function (repo) {
      var cat = classify(repo);
      grouped[cat.name].push(repo);
    });

    var html = '';
    CATEGORIES.forEach(function (c) {
      html += renderCategory(c, grouped[c.name]);
    });
    html += renderCategory({ name: DEFAULT_CATEGORY, desc: '其他技术项目与研究' }, grouped[DEFAULT_CATEGORY]);

    if (!all.length) {
      html = renderEmpty('暂无项目。项目发布到 GitHub 后会自动显示在这里。');
    }

    html += '<div class="projects-note">列表数据来自本地快照，每天自动从 GitHub 刷新一次，打开页面时再实时同步一次。新建仓库并打上对应 topic 标签，会自动归入相应分类。</div>';

    container.innerHTML = html;
  }

  // 实时接口对 fork 仓库不返回 language（GitHub 对 fork 一律返回 null），
  // 而快照里的 language 已经查过父仓库补全。这里用快照的值补齐实时数据，
  // 避免首屏显示语言标签、后台刷新后标签消失的跳变。
  function patchFromSnapshot(live) {
    if (!snapshotRepos || !Array.isArray(live)) return live;
    var cached = {};
    snapshotRepos.forEach(function (r) { cached[r.name] = r; });
    return live.map(function (repo) {
      var old = cached[repo.name];
      if (old && !repo.language) repo.language = old.language || null;
      return repo;
    });
  }

  // 请求一个 JSON 接口，失败抛错
  function loadJSON(url) {
    return fetch(url).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    });
  }

  function main() {
    // 先读本地快照，立即渲染，保证任何网络环境都能正常显示（不受 GitHub API 限流影响）
    // 快照由 GitHub Actions 每天自动刷新，所以即使实时接口完全不可用，页面也是最新的
    loadJSON('/assets/data/repos.json')
      .then(function (data) {
        snapshotRepos = data;
        renderRepos(data);
      })
      .catch(function () {
        // 快照读取失败（极少见），退回实时接口
        return loadJSON(API_URL).then(function (data) { renderRepos(data); });
      })
      .catch(function (err) {
        container.innerHTML = renderEmpty('加载失败：' + err.message + '。请稍后刷新重试。');
      })
      .finally(function () {
        if (loading) loading.style.display = 'none';
      });

    // 后台再拉一次实时接口，成功则刷新，让刚建的仓库立刻出现；403/限流则静默忽略，快照已兜底
    loadJSON(API_URL)
      .then(function (data) { renderRepos(patchFromSnapshot(data)); })
      .catch(function () { /* 忽略，快照已经显示了项目列表 */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
