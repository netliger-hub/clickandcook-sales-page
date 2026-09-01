<?php
/**
 * ============================================================
 * Click & Cook — Messenger Welcome Bot (Vercel Serverless PHP)
 * ------------------------------------------------------------
 * Webhook รับ event จาก Messenger Platform แล้วตอบกลับอัตโนมัติ:
 *   ลูกค้าทักแชท (message)      → ข้อความต้อนรับ + เมนูปุ่มเลือกแพ็ก
 *   ลูกค้ากดปุ่ม (postback)     → รายละเอียดแพ็กนั้น + ลิงก์กลับหน้าขาย
 *
 * ตั้งค่าใน Vercel → Settings → Environment Variables:
 *   PAGE_ACCESS_TOKEN  — Page token สิทธิ์ pages_messaging
 *   WEBHOOK_VERIFY_TOKEN — รหัสลับตั้งเอง (ใช้ตอน verify webhook
 *                          ในหน้า developers.facebook.com)
 *   SALE_PAGE_URL      — (optional) ลิงก์หน้าขาย (default ดู constants)
 *
 * Webhook URL (หลัง deploy): https://clickandcook.online/api/bot
 * ============================================================
 */

const GRAPH = 'https://graph.facebook.com/v21.0/';
const PAGE_ID = '720963661092952';
const DEFAULT_SALE_URL = 'https://clickandcook.online/';

/* ---------- เนื้อหาข้อความ (แก้ copy ได้ตรงนี้) ---------- */

const WELCOME_TEXT = "สวัสดีค่ะ ยินดีต้อนรับเข้าสู่แชท Click & Cook 🍮\n\nเราครูพี่เมย์ และครูผึ้ง — ทุกสูตรเป็นตัวเลขจริง คิดต้นทุนให้พร้อมขาย นักเรียนแล้วกว่า 1,000 คน\n\nเลือกแพ็กที่สนใจได้เลยค่ะ 👇";

const MENU_BUTTONS = [
  [
    'type'    => 'postback',
    'title'   => 'เหมาทุกคอร์ส 1,490.-',
    'payload' => 'PKG_ALL',
  ],
  [
    'type'    => 'postback',
    'title'   => 'คอร์สเดี่ยว 479.-',
    'payload' => 'PKG_SINGLE',
  ],
  [
    'type'    => 'postback',
    'title'   => 'ดูรีวิวนักเรียน',
    'payload' => 'SEE_REVIEWS',
  ],
];

const REPLIES = [
  'PKG_ALL' => [
    "ทักทายสุดพิเศษเฉพาะในแชทนี้ค่ะ 🎉\n\n✅ เหมาทุกคอร์ส 6 คอร์ส รวม 68 เมนู\n💰 จากปกติ 2,895.- เหลือ 1,490.- (จำกัด 100 คนแรก)\n✨ เริ่มจากศูนย์ก็ทำตามได้ ดูย้อนหลังได้ตลอด ถามครูได้ตลอด\n\nดูรายละเอียดเต็ม ๆ ที่หน้าเว็บได้เลยค่ะ 👇",
    ['url' => 'ดูรายละเอียด + สมัครเหมา 1,490.-'],
  ],
  'PKG_SINGLE' => [
    "คอร์สเดี่ยว 479.- ค่ะ เลือกได้ 6 คอร์ส:\n\n🧋 Yogurt Mania — โยเกิร์ตปั่น 9 เมนู\n🍵 Matcha Mania — มัทฉะครบทุกสไตล์\n🥤 คอร์สชาใส — ชานม/ชาผลไม้\n🧀 Cheese Pie Mania — ชีสพายเวอร์ชั่นขาย\n🥞 3X Banana Crepe — เครปกล้นไม้ 3 สูตร\n📸 Click & Cook Gen Image — ถ่ายรูปขายออนไลน์\n\nดูรายละเอียดแต่ละคอร์สที่หน้าเว็บได้เลยค่ะ 👇",
    ['url' => 'ดูคอร์สทั้งหมด'],
  ],
  'SEE_REVIEWS' => [
    "รีวิวจากนักเรียนจริงที่ทำตามสูตรแล้วขายได้ค่ะ 💛\n\nเลื่อนดูแคปแชทจริงได้ที่หน้าเว็บเลย — ใคร ๆ ก็เริ่มขายได้จริงค่ะ 👇",
    ['url' => 'ดูรีวิวนักเรียน'],
  ],
];

const FALLBACK_TEXT = "ขอบคุณที่ทักมานะคะ 💛 แอดมินจะรีบตอบเองให้เร็วที่สุดค่ะ\n\nระหว่างนี้กดดูรายละเอียดแพ็กที่สนใจได้เลยค่ะ 👇";

/* ---------- helpers ---------- */

function envToken(string $key): string {
  return getenv($key) ?: '';
}

function httpJson(string $url, array $payload): void {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_SSL_VERIFYPEER => true,
  ]);
  curl_exec($ch);
  unset($ch);
}

function sendText(string $psid, string $text): void {
  httpJson(GRAPH . 'me/messages?access_token=' . urlencode(envToken('PAGE_ACCESS_TOKEN')), [
    'recipient' => ['id' => $psid],
    'message'   => ['text' => $text],
  ]);
}

function sendMenu(string $psid, string $text, ?array $urlButton = null): void {
  $buttons = $urlButton
    ? array_merge([[
        'type'  => 'web_url',
        'url'   => getenv('SALE_PAGE_URL') ?: DEFAULT_SALE_URL,
        'title' => $urlButton['url'],
      ]], array_slice(MENU_BUTTONS, 0, 2))
    : MENU_BUTTONS;
  // Messenger จำกัดสูงสุด 3 ปุ่มต่อข้อความ
  $buttons = array_slice($buttons, 0, 3);

  httpJson(GRAPH . 'me/messages?access_token=' . urlencode(envToken('PAGE_ACCESS_TOKEN')), [
    'recipient' => ['id' => $psid],
    'message'   => [
      'attachment' => [
        'type'    => 'template',
        'payload' => [
          'template_type' => 'button',
          'text'          => $text,
          'buttons'       => $buttons,
        ],
      ],
    ],
  ]);
}

/* ---------- webhook verify (GET) ---------- */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $mode      = $_GET['hub_mode'] ?? '';
  $token     = $_GET['hub_verify_token'] ?? '';
  $challenge = $_GET['hub_challenge'] ?? '';

  if ($mode === 'subscribe' && hash_equals(envToken('WEBHOOK_VERIFY_TOKEN'), (string)$token)) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $challenge;
    exit;
  }
  http_response_code(403);
  exit(json_encode(['ok' => false, 'error' => 'verify_failed']));
}

/* ---------- webhook events (POST) ---------- */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  exit(json_encode(['ok' => false, 'error' => 'method_not_allowed']));
}

// ตอบ Meta ทันที (ต้องตอบ 200 ภายใน 20 วิ — ส่งข้อความแบบหลังบ้าน)
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['ok' => true]);
// ปิด connection ให้ client ไม่รอ แต่ PHP ทำงานต่อ
if (function_exists('fastcgi_finish_request')) {
  fastcgi_finish_request();
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) exit;

$pageId = (string)(PAGE_ID);

foreach (($input['entry'] ?? []) as $entry) {
  foreach (($entry['messaging'] ?? []) as $event) {
    $psid = $event['sender']['id'] ?? '';
    if ($psid === '') continue;

    // ตัด echo ของข้อความที่เพจส่งเอง (กัน loop)
    if (isset($event['message']['is_echo']) && $event['message']['is_echo']) continue;

    if (isset($event['postback']['payload'])) {
      $payload = (string)$event['postback']['payload'];
      if (isset(REPLIES[$payload])) {
        [$text, $btn] = REPLIES[$payload];
        sendMenu($psid, $text, $btn);
      } else {
        sendMenu($psid, FALLBACK_TEXT, null);
      }
      continue;
    }

    if (isset($event['message']['text'])) {
      // ข้อความแรกที่ลูกค้าพิมพ์เอง → ต้อนรับ + เมนู
      sendMenu($psid, WELCOME_TEXT, null);
    }
  }
}
