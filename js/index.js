/* index.js —— 首页：加载 JSON，渲染统计卡片与公告 */

document.addEventListener("DOMContentLoaded", function () {
  loadIndexData();
});

function loadIndexData() {
  loadRoomData()
    .then(function (data) {
      renderStats(data.rooms, data.updated);
      renderNotices(data.notices || []);
    })
    .catch(function (err) {
      console.error("首页数据加载失败：", err);
      showLoadError("index-error", loadIndexData);
      document.getElementById("data-updated").textContent = "加载失败";
    });
}

/** 渲染四个统计卡片 */
function renderStats(rooms, updated) {
  var totalRooms = rooms.length;
  var totalSeats = 0;
  var occupied = 0;
  rooms.forEach(function (r) {
    totalSeats += r.totalSeats;
    occupied += r.occupiedSeats;
  });
  var free = totalSeats - occupied;
  var avgRate = totalSeats === 0 ? 0 : ((occupied / totalSeats) * 100).toFixed(1);

  document.getElementById("stat-rooms").textContent = totalRooms;
  document.getElementById("stat-seats").textContent = totalSeats;
  document.getElementById("stat-free").textContent = free;
  document.getElementById("stat-rate").textContent = avgRate;
  document.getElementById("data-updated").textContent = updated;
}

/** 渲染公告列表；没有公告时显示空提示 */
function renderNotices(notices) {
  var list = document.getElementById("notice-list");
  if (notices.length === 0) {
    list.innerHTML = '<li class="list-group-item text-muted">暂无公告。</li>';
    return;
  }
  list.innerHTML = notices
    .map(function (n) {
      return '<li class="list-group-item">' + escapeHtml(n) + "</li>";
    })
    .join("");
}
