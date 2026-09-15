---
permalink: /projects/
title: "项目"
toc: false
---

这里展示我在 GitHub 上的项目和研究过的开源项目，按技术方向分类。**列表每天自动从我的 GitHub 仓库同步**，新建的仓库会自动出现，不需要手动添加。

<style>
  .project-category {
    margin-top: 2em;
    margin-bottom: 1em;
    padding-bottom: 0.4em;
    border-bottom: 2px solid #eee;
  }
  .project-category h2 {
    margin: 0;
    font-size: 1.4em;
  }
  .project-category .cat-desc {
    color: #888;
    font-size: 0.9em;
    margin-top: 0.2em;
  }
  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1em;
    margin-bottom: 1.5em;
  }
  .project-card {
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 1em 1.1em;
    background: #fff;
    transition: box-shadow .15s ease, border-color .15s ease;
    display: flex;
    flex-direction: column;
  }
  .project-card:hover {
    border-color: #aaa;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  .project-card .name {
    margin: 0 0 0.4em;
    font-size: 1.05em;
    font-weight: 600;
  }
  .project-card .name a {
    text-decoration: none;
  }
  .project-card .desc {
    color: #555;
    font-size: 0.9em;
    line-height: 1.5;
    margin: 0 0 0.8em;
    flex: 1;
  }
  .project-card .meta {
    font-size: 0.8em;
    color: #888;
    display: flex;
    flex-wrap: wrap;
    gap: 0.6em;
  }
  .project-card .meta .lang-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 3px;
    vertical-align: -1px;
  }
  .projects-note {
    margin-top: 1em;
    padding: 0.8em 1em;
    background: #f7f7f7;
    border-radius: 6px;
    font-size: 0.85em;
    color: #666;
  }
</style>

<div id="projects-loading">
  <p>正在从 GitHub 加载项目，请稍候...</p>
</div>

<div id="projects-container"></div>

<script src="/assets/js/projects.js"></script>
