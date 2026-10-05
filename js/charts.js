/* charts.js —— 数据可视化页：用 ECharts 渲染饼图、柱状图、折线图 */

var chartInstances = []; // 保存图表实例，便于窗口缩放时统一 resize

document.addEventListener("DOMContentLoaded", function () {
  initChartsPage();

  // 窗口尺寸变化时重绘图表，保证响应式效果
  window.addEventListener("resize", function () {
    chartInstances.forEach(function (chart) {
      chart.resize();
    });
  });
});

function initChartsPage() {
  loadRoomData()
    .then(function (data) {
      renderPieChart(data.rooms);
      renderBarChart(data.rooms);
      renderLineChart(data.weeklyTrend);
      renderDataTable(data.rooms);
    })
    .catch(function (err) {
      console.error("图表数据加载失败：", err);
      showLoadError("charts-error", initChartsPage);
    });
}

/** 饼图：全校座位 已占用 / 空闲 占比 */
function renderPieChart(rooms) {
  var totalSeats = 0;
  var occupied = 0;
  rooms.forEach(function (r) {
    totalSeats += r.totalSeats;
    occupied += r.occupiedSeats;
  });

  var chart = echarts.init(document.getElementById("pie-chart"));
  chart.setOption({
    tooltip: { trigger: "item", formatter: "{b}：{c} 个（{d}%）" },
    legend: { bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"], // 环形饼图
        label: { formatter: "{b}\n{d}%" },
        data: [
          { value: occupied, name: "已占用", itemStyle: { color: "#e01b24" } },
          { value: totalSeats - occupied, name: "空闲", itemStyle: { color: "#2ec27e" } }
        ]
      }
    ]
  });
  chartInstances.push(chart);
}

/** 柱状图：各自习室上座率对比，按上座率从高到低排序 */
function renderBarChart(rooms) {
  // 复制数组再排序，避免影响原始数据
  var sorted = rooms.slice().sort(function (a, b) {
    return b.occupiedSeats / b.totalSeats - a.occupiedSeats / a.totalSeats;
  });
  var names = sorted.map(function (r) { return r.name; });
  var rates = sorted.map(function (r) { return Number(occupancyRate(r)); });

  var chart = echarts.init(document.getElementById("bar-chart"));
  chart.setOption({
    tooltip: { trigger: "axis", formatter: "{b}<br/>上座率：{c}%" },
    grid: { left: 10, right: 20, bottom: 10, top: 30, containLabel: true },
    xAxis: {
      type: "category",
      data: names,
      axisLabel: { interval: 0, rotate: 30, fontSize: 10 }
    },
    yAxis: { type: "value", max: 100, name: "%" },
    series: [
      {
        type: "bar",
        data: rates,
        barWidth: "55%",
        itemStyle: {
          // 按上座率高低给柱子上色：>=90% 红，>=60% 橙，其余绿
          color: function (params) {
            var v = params.value;
            if (v >= 90) return "#e01b24";
            if (v >= 60) return "#f5a211";
            return "#2ec27e";
          }
        }
      }
    ]
  });
  chartInstances.push(chart);
}

/** 折线图：一周两校区自习签到人次趋势 */
function renderLineChart(weeklyTrend) {
  var chart = echarts.init(document.getElementById("line-chart"));
  chart.setOption({
    tooltip: { trigger: "axis" },
    legend: { bottom: 0 },
    grid: { left: 10, right: 20, bottom: 40, top: 30, containLabel: true },
    xAxis: { type: "category", data: weeklyTrend.days, boundaryGap: false },
    yAxis: { type: "value", name: "人次" },
    series: weeklyTrend.series.map(function (s, idx) {
      return {
        name: s.campus,
        type: "line",
        smooth: true,
        data: s.checkins,
        areaStyle: idx === 0 ? { opacity: 0.15 } : undefined // 第一条线加浅色面积填充
      };
    })
  });
  chartInstances.push(chart);
}

/** 数据对照表：把图表背后的原始数据列出来，便于核验一致性 */
function renderDataTable(rooms) {
  var tbody = document.querySelector("#data-table tbody");
  var html = "";
  rooms.forEach(function (r) {
    html +=
      "<tr><td>" + escapeHtml(r.name) + "</td><td>" + escapeHtml(r.campus) +
      "</td><td>" + r.totalSeats + "</td><td>" + r.occupiedSeats +
      "</td><td>" + occupancyRate(r) + "%</td></tr>";
  });
  tbody.innerHTML = html;
}
