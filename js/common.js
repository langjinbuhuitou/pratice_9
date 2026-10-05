/* common.js —— 公共模块：JSON 数据加载、错误提示、导航高亮、工具函数 */

/**
 * 加载自习室 JSON 数据（fetch 本地 JSON 文件）
 * @returns {Promise<Object>} 解析后的数据对象
 */
function loadRoomData() {
  return fetch("data/rooms.json")
    .then(function (response) {
      // HTTP 状态非 200 时视为加载失败
      if (!response.ok) {
        throw new Error("HTTP 状态码：" + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      // 校验数据结构，防止 JSON 格式损坏
      if (!data || !Array.isArray(data.rooms)) {
        throw new Error("数据格式不正确：缺少 rooms 数组");
      }
      return data;
    });
}

/**
 * 在指定容器中显示"加载失败"的 Bootstrap 警告框，并提供重试按钮
 * @param {string} containerId 容器元素 id
 * @param {Function} onRetry 点击重试按钮时的回调
 */
function showLoadError(containerId, onRetry) {
  var box = document.getElementById(containerId);
  box.innerHTML =
    '<div class="alert alert-danger d-flex align-items-center justify-content-between" role="alert">' +
    "<span><strong>数据加载失败：</strong>请检查网络连接，或确认通过本地服务器（如 Live Server）访问本页面。" +
    '<a href="#data-error-help" data-bs-toggle="collapse">查看解决办法</a></span>' +
    '<button type="button" class="btn btn-outline-danger btn-sm" id="retry-btn">重试</button>' +
    "</div>" +
    '<div class="collapse" id="data-error-help">' +
    '<div class="card card-body small text-muted">' +
    "直接双击 html 文件（file:// 协议）会导致浏览器拦截 JSON 请求。请使用 VS Code 的 Live Server 插件，" +
    "或在项目目录运行 <code>py -m http.server 8000</code> 后访问 <code>http://localhost:8000</code>。" +
    "</div></div>";
  document.getElementById("retry-btn").addEventListener("click", onRetry);
}

/**
 * 在指定容器中显示"数据为空"的空状态提示
 * @param {string} containerId 容器元素 id
 * @param {string} message 提示文字
 */
function showEmptyState(containerId, message) {
  var box = document.getElementById(containerId);
  box.innerHTML =
    '<div class="empty-state">' +
    '<div class="empty-icon">&#128269;</div>' +
    "<p>" + message + "</p>" +
    '<button type="button" class="btn btn-outline-primary btn-sm" id="empty-reset-btn">清空筛选条件</button>' +
    "</div>";
}

/** 根据当前页面文件名高亮导航栏对应链接 */
function setActiveNav() {
  var page = location.pathname.split("/").pop() || "index.html";
  var links = document.querySelectorAll(".navbar-nav .nav-link");
  links.forEach(function (link) {
    if (link.getAttribute("href") === page) {
      link.classList.add("active");
    }
  });
}

/**
 * HTML 转义，防止把用户输入直接拼接进页面造成 XSS
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 计算上座率（百分比，保留 1 位小数）
 */
function occupancyRate(room) {
  return ((room.occupiedSeats / room.totalSeats) * 100).toFixed(1);
}

/**
 * 根据上座率返回状态对象：文字 + Bootstrap 颜色类名
 * <60% 空闲充足；60%~90% 座位紧张；>=90% 即将满员
 */
function roomStatus(room) {
  var rate = room.occupiedSeats / room.totalSeats;
  if (rate >= 0.9) {
    return { text: "即将满员", color: "danger", barColor: "bg-danger" };
  } else if (rate >= 0.6) {
    return { text: "座位紧张", color: "warning", barColor: "bg-warning" };
  }
  return { text: "空闲充足", color: "success", barColor: "bg-success" };
}

// 页面加载完成后统一设置导航高亮和页脚年份
document.addEventListener("DOMContentLoaded", function () {
  setActiveNav();
  var yearBox = document.getElementById("footer-year");
  if (yearBox) {
    yearBox.textContent = new Date().getFullYear();
  }
});
