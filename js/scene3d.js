/* scene3d.js —— 三维自习室：Three.js 座位布局漫游 + 点击查看座位状态 */

var scene, camera, renderer, controls;
var seatMeshes = [];   // 当前场景中所有可点击的座位网格
var seatGroup = null;  // 座位组合，切换自习室时整体移除重建
var raycaster, mouse;
var allRoomsData = [];

var SEATS_PER_ROW = 10; // 每排座位数
var COLOR_FREE = 0x2ec27e;
var COLOR_OCCUPIED = 0xe01b24;

document.addEventListener("DOMContentLoaded", function () {
  loadRoomData()
    .then(function (data) {
      allRoomsData = data.rooms;
      fillRoomSelect(allRoomsData);
      try {
        initScene();
      } catch (e) {
        // 浏览器不支持 WebGL 等情况
        console.error("三维场景初始化失败：", e);
        document.getElementById("scene-error").innerHTML =
          '<div class="alert alert-danger">当前浏览器不支持 WebGL，无法展示三维场景，请更换现代浏览器（Chrome / Edge）。</div>';
        return;
      }
      buildRoom(allRoomsData[0]);
      animate();
    })
    .catch(function (err) {
      console.error("三维页面数据加载失败：", err);
      showLoadError("scene-error", function () { location.reload(); });
    });

  // 切换自习室时重建座位布局
  document.getElementById("room-select").addEventListener("change", function () {
    var id = this.value;
    for (var i = 0; i < allRoomsData.length; i++) {
      if (allRoomsData[i].id === id) {
        buildRoom(allRoomsData[i]);
        break;
      }
    }
  });

  // 点击座位
  var container = document.getElementById("scene-container");
  container.addEventListener("click", onSeatClick);
});

/** 填充自习室下拉框 */
function fillRoomSelect(rooms) {
  var select = document.getElementById("room-select");
  rooms.forEach(function (r) {
    var opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.name + "（上座率 " + occupancyRate(r) + "%）";
    select.appendChild(opt);
  });
}

/** 初始化场景、相机、灯光、渲染器、轨道控制器 */
function initScene() {
  var container = document.getElementById("scene-container");
  var width = container.clientWidth;
  var height = container.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1f26);

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // 灯光：环境光 + 方向光
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // 轨道控制器：支持旋转 / 缩放 / 平移
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // 窗口缩放时自适应
  window.addEventListener("resize", function () {
    var w = container.clientWidth;
    var h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

/**
 * 简单可复现的伪随机数生成器（mulberry32）
 * 用自习室 id 作种子，保证每次打开页面座位占用分布一致
 */
function seededRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 把字符串转成数字种子 */
function hashCode(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * 根据自习室数据生成每个座位的占用状态数组
 * 占用数量与 JSON 中的 occupiedSeats 严格一致
 */
function makeSeatStates(room) {
  var states = [];
  var i;
  for (i = 0; i < room.totalSeats; i++) {
    states.push(false); // 先全部置为空闲
  }
  // 用固定种子洗牌，挑出 occupiedSeats 个座位置为占用
  var rand = seededRandom(hashCode(room.id));
  var picked = 0;
  while (picked < room.occupiedSeats) {
    var idx = Math.floor(rand() * room.totalSeats);
    if (!states[idx]) {
      states[idx] = true;
      picked++;
    }
  }
  return states;
}

/** 根据选中的自习室重建整个座位场景 */
function buildRoom(room) {
  // 清除旧的座位组
  if (seatGroup) {
    scene.remove(seatGroup);
  }
  seatGroup = new THREE.Group();
  seatMeshes = [];

  var states = makeSeatStates(room);
  var rows = Math.ceil(room.totalSeats / SEATS_PER_ROW);

  // 地板
  var floorWidth = SEATS_PER_ROW * 1.4 + 2;
  var floorDepth = rows * 1.8 + 2;
  var floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorWidth, floorDepth),
    new THREE.MeshLambertMaterial({ color: 0x3a3f4a })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((SEATS_PER_ROW - 1) * 1.4 / 2, 0, (rows - 1) * 1.8 / 2);
  seatGroup.add(floor);

  // 逐个生成座位：桌子（棕色盒子）+ 椅子（绿/红盒子）
  var deskMaterial = new THREE.MeshLambertMaterial({ color: 0x8a6d3b });
  for (var i = 0; i < room.totalSeats; i++) {
    var row = Math.floor(i / SEATS_PER_ROW);
    var col = i % SEATS_PER_ROW;
    var x = col * 1.4;
    var z = row * 1.8;

    // 桌子
    var desk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.5), deskMaterial);
    desk.position.set(x, 0.35, z);
    // 座位信息同时挂在桌子和椅子上，点中哪个都能查看（增大可点范围）
    var seatInfo = {
      seatNo: String.fromCharCode(65 + row) + "-" + ("0" + (col + 1)).slice(-2),
      occupied: states[i],
      roomName: room.name
    };
    desk.userData = seatInfo;
    seatGroup.add(desk);
    seatMeshes.push(desk);

    // 椅子：颜色表示占用状态
    var chairColor = states[i] ? COLOR_OCCUPIED : COLOR_FREE;
    var chair = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: chairColor })
    );
    chair.position.set(x, 0.25, z + 0.7);
    chair.userData = seatInfo;
    seatGroup.add(chair);
    seatMeshes.push(chair);

    // 占用的座位上加一个"人"（小球），更直观
    if (states[i]) {
      var person = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 12),
        new THREE.MeshLambertMaterial({ color: 0xf8e45c })
      );
      person.position.set(x, 0.75, z + 0.7);
      seatGroup.add(person);
    }
  }

  scene.add(seatGroup);

  // 相机放到房间斜上方，对准座位区中心（距离随座位排数调整）
  var centerX = (SEATS_PER_ROW - 1) * 1.4 / 2;
  var centerZ = (rows - 1) * 1.8 / 2;
  camera.position.set(centerX, rows * 0.9 + 5, centerZ + rows * 1.3 + 5);
  controls.target.set(centerX, 0, centerZ);
  controls.update();

  // 重置座位信息面板
  document.getElementById("seat-info-text").textContent =
    room.name + "：共 " + room.totalSeats + " 个座位，空闲 " +
    (room.totalSeats - room.occupiedSeats) + " 个。点击座位查看详情。";
}

/** 点击画布：用射线检测判断是否点中座位 */
function onSeatClick(event) {
  var container = document.getElementById("scene-container");
  var rect = container.getBoundingClientRect();
  // 把鼠标坐标换算成 -1 ~ 1 的标准化设备坐标
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  var hits = raycaster.intersectObjects(seatMeshes);
  if (hits.length === 0) return;

  var info = hits[0].object.userData;
  var statusHtml = info.occupied
    ? '<span class="badge bg-danger">已占用</span>'
    : '<span class="badge bg-success">空闲</span>';
  document.getElementById("seat-info-text").innerHTML =
    "座位号：<strong>" + info.seatNo + "</strong><br>状态：" + statusHtml +
    "<br>所属：" + escapeHtml(info.roomName);
}

/** 渲染循环 */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
