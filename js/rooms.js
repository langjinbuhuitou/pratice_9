/* rooms.js —— 自习室查询页：筛选、搜索、排序、详情模态框、错误处理 */

var allRooms = []; // 缓存 JSON 加载的全部自习室数据

document.addEventListener("DOMContentLoaded", function () {
  initRoomsPage();

  // 表单提交 = 点击"搜索"按钮
  document.getElementById("filter-form").addEventListener("submit", function (e) {
    e.preventDefault();
    applyFilters();
  });

  // 下拉框与复选框变化时立即刷新结果（不用每次点搜索）
  var instantControls = document.querySelectorAll(
    "#campus-select, #floor-select, #status-select, #sort-select, .facility-check"
  );
  instantControls.forEach(function (el) {
    el.addEventListener("change", applyFilters);
  });

  // 重置按钮：清空所有条件并重新渲染
  document.getElementById("reset-btn").addEventListener("click", resetFilters);
});

/** 加载数据并初始化筛选下拉框 */
function initRoomsPage() {
  loadRoomData()
    .then(function (data) {
      allRooms = data.rooms;
      fillSelectOptions(allRooms);
      applyFilters();
    })
    .catch(function (err) {
      console.error("自习室数据加载失败：", err);
      showLoadError("rooms-error", initRoomsPage);
      document.getElementById("room-list").innerHTML = "";
      document.getElementById("result-count").textContent = "共 0 个结果";
    });
}

/** 根据数据动态生成校区、楼层下拉框选项（避免在 HTML 里写死） */
function fillSelectOptions(rooms) {
  var campusSet = {};
  var floorSet = {};
  rooms.forEach(function (r) {
    campusSet[r.campus] = true;
    floorSet[r.floor] = true;
  });

  var campusSelect = document.getElementById("campus-select");
  Object.keys(campusSet).forEach(function (campus) {
    var opt = document.createElement("option");
    opt.value = campus;
    opt.textContent = campus;
    campusSelect.appendChild(opt);
  });

  var floorSelect = document.getElementById("floor-select");
  Object.keys(floorSet)
    .sort(function (a, b) { return a - b; })
    .forEach(function (floor) {
      var opt = document.createElement("option");
      opt.value = floor;
      opt.textContent = floor + " 层";
      floorSelect.appendChild(opt);
    });
}

/** 校验搜索关键词：仅允许中文、字母、数字和空格，最长 20 字符 */
function validateKeyword(keyword) {
  if (keyword === "") return true; // 允许为空（表示不搜索）
  var pattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s]{1,20}$/;
  return pattern.test(keyword);
}

/** 读取当前筛选条件，过滤 + 排序后渲染列表 */
function applyFilters() {
  var campus = document.getElementById("campus-select").value;
  var floor = document.getElementById("floor-select").value;
  var status = document.getElementById("status-select").value;
  var sortType = document.getElementById("sort-select").value;
  var keywordInput = document.getElementById("keyword-input");
  var keyword = keywordInput.value.trim();

  // 非法输入校验：不通过则标红输入框并停止查询
  if (!validateKeyword(keyword)) {
    keywordInput.classList.add("is-invalid");
    return;
  }
  keywordInput.classList.remove("is-invalid");

  // 勾选的设施列表
  var facilities = [];
  document.querySelectorAll(".facility-check:checked").forEach(function (cb) {
    facilities.push(cb.value);
  });

  // 1. 过滤
  var filtered = allRooms.filter(function (room) {
    if (campus && room.campus !== campus) return false;
    if (floor && String(room.floor) !== floor) return false;
    if (status && roomStatus(room).text !== status) return false;
    if (keyword && room.name.indexOf(keyword) === -1 && room.building.indexOf(keyword) === -1) {
      return false;
    }
    // 设施筛选：必须同时包含所有勾选设施
    for (var i = 0; i < facilities.length; i++) {
      if (room.facilities.indexOf(facilities[i]) === -1) return false;
    }
    return true;
  });

  // 2. 排序
  filtered.sort(function (a, b) {
    if (sortType === "rate-asc") {
      return a.occupiedSeats / a.totalSeats - b.occupiedSeats / b.totalSeats;
    }
    if (sortType === "rate-desc") {
      return b.occupiedSeats / b.totalSeats - a.occupiedSeats / a.totalSeats;
    }
    return b.totalSeats - a.totalSeats; // seats-desc
  });

  renderRoomList(filtered);
}

/** 渲染结果卡片；无结果时显示空状态 */
function renderRoomList(rooms) {
  var list = document.getElementById("room-list");
  document.getElementById("result-count").textContent = "共 " + rooms.length + " 个结果";

  if (rooms.length === 0) {
    showEmptyState("room-list", "没有符合条件的自习室，试试放宽筛选条件。");
    document.getElementById("empty-reset-btn").addEventListener("click", resetFilters);
    return;
  }

  var html = "";
  rooms.forEach(function (room) {
    var st = roomStatus(room);
    var rate = occupancyRate(room);
    var facilityBadges = room.facilities
      .map(function (f) {
        return '<span class="badge badge-facility">' + escapeHtml(f) + "</span>";
      })
      .join("");

    html +=
      '<div class="col-12 col-md-6 col-lg-4">' +
      '<div class="card room-card p-3">' +
      '<div class="d-flex justify-content-between align-items-start">' +
      '<h2 class="h5 mb-1">' + escapeHtml(room.name) + "</h2>" +
      '<span class="badge bg-' + st.color + '">' + st.text + "</span>" +
      "</div>" +
      '<p class="text-muted small mb-2">' +
      escapeHtml(room.campus) + " · " + escapeHtml(room.building) + " · " + room.floor + " 层 · " + room.openTime +
      "</p>" +
      '<div class="mb-1 small">上座率 ' + rate + "%（" + room.occupiedSeats + "/" + room.totalSeats + "）</div>" +
      '<div class="progress mb-2">' +
      '<div class="progress-bar ' + st.barColor + '" style="width: ' + rate + '%"></div>' +
      "</div>" +
      '<div class="mb-2">' + facilityBadges + "</div>" +
      '<button type="button" class="btn btn-outline-primary btn-sm mt-auto detail-btn" data-room-id="' + room.id + '">查看详情</button>' +
      "</div></div>";
  });
  list.innerHTML = html;

  // 给每个"查看详情"按钮绑定模态框
  var detailBtns = list.querySelectorAll(".detail-btn");
  detailBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      showRoomDetail(btn.getAttribute("data-room-id"));
    });
  });
}

/** 在模态框中展示单个自习室详情 */
function showRoomDetail(roomId) {
  var room = null;
  for (var i = 0; i < allRooms.length; i++) {
    if (allRooms[i].id === roomId) {
      room = allRooms[i];
      break;
    }
  }
  if (!room) return;

  var st = roomStatus(room);
  var rate = occupancyRate(room);
  var freeSeats = room.totalSeats - room.occupiedSeats;
  // 根据空闲情况给出建议文案
  var advice = freeSeats >= 20
    ? "空位较多，推荐前往。"
    : freeSeats > 0
      ? "剩余空位不多，建议尽快前往或选择其他自习室。"
      : "已满员，请选择其他自习室。";

  document.getElementById("modal-title").textContent = room.name;
  document.getElementById("modal-body").innerHTML =
    '<p><span class="badge bg-' + st.color + '">' + st.text + "</span></p>" +
    "<ul class='list-unstyled'>" +
    "<li>校区：" + escapeHtml(room.campus) + "</li>" +
    "<li>位置：" + escapeHtml(room.building) + " " + room.floor + " 层</li>" +
    "<li>开放时间：" + room.openTime + "</li>" +
    "<li>座位：共 " + room.totalSeats + " 个，空闲 " + freeSeats + " 个</li>" +
    "<li>上座率：" + rate + "%</li>" +
    "<li>设施：" + room.facilities.map(escapeHtml).join("、") + "</li>" +
    "</ul>" +
    '<div class="alert alert-info mb-0">' + advice + "</div>";

  var modal = new bootstrap.Modal(document.getElementById("room-modal"));
  modal.show();
}

/** 清空所有筛选条件并重新渲染 */
function resetFilters() {
  document.getElementById("campus-select").value = "";
  document.getElementById("floor-select").value = "";
  document.getElementById("status-select").value = "";
  document.getElementById("sort-select").value = "rate-asc";
  var keywordInput = document.getElementById("keyword-input");
  keywordInput.value = "";
  keywordInput.classList.remove("is-invalid");
  document.querySelectorAll(".facility-check:checked").forEach(function (cb) {
    cb.checked = false;
  });
  applyFilters();
}
