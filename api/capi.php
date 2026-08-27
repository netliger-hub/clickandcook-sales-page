<?php
/**
 * ============================================================
 * Click & Cook — Conversions API Relay (Vercel Serverless PHP)
 * ------------------------------------------------------------
 * สำหรับ deploy บน Vercel เท่านั้น — vercel.json map ไฟล์นี้
 * ผ่าน runtime vercel-php@0.9.0 (PHP 8.5)
 *
 * Access Token: ตั้งใน Vercel → Project → Settings →
 * Environment Variables → key = FB_ACCESS_TOKEN
 * ============================================================
 */

define('FB_PIXEL_ID', '1052233364217187');
define('GRAPH_VERSION', 'v21.0');

$accessToken = getenv('FB_ACCESS_TOKEN') ?: '';
if ($accessToken === '') {
  http_response_code(500);
  exit(json_encode(['ok' => false, 'error' => 'token_not_configured']));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  exit(json_encode(['ok' => false, 'error' => 'method_not_allowed']));
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
  http_response_code(400);
  exit(json_encode(['ok' => false, 'error' => 'bad_json']));
}

$eventName = isset($data['event_name']) ? (string)$data['event_name'] : '';
if (!preg_match('/^[A-Za-z0-9_]{1,80}$/', $eventName)) {
  http_response_code(400);
  exit(json_encode(['ok' => false, 'error' => 'invalid_event_name']));
}

$eventId = (isset($data['event_id']) && preg_match('/^[A-Za-z0-9_-]{1,64}$/', (string)$data['event_id']))
  ? (string)$data['event_id']
  : bin2hex(random_bytes(8));

$userData = [];
$ip = '';
if (!empty($_SERVER['HTTP_CF_CONNECTING_IP']))       $ip = $_SERVER['HTTP_CF_CONNECTING_IP'];
elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR']))    $ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
elseif (!empty($_SERVER['X_VERCEL_FORWARDED_FOR']))  $ip = trim(explode(',', $_SERVER['X_VERCEL_FORWARDED_FOR'])[0]);
elseif (!empty($_SERVER['REMOTE_ADDR']))             $ip = $_SERVER['REMOTE_ADDR'];
if (filter_var($ip, FILTER_VALIDATE_IP))              $userData['client_ip_address'] = $ip;
if (!empty($_SERVER['HTTP_USER_AGENT']))              $userData['client_user_agent'] = (string)$_SERVER['HTTP_USER_AGENT'];
if (!empty($data['fbp']) && is_string($data['fbp']))  $userData['fbp'] = substr($data['fbp'], 0, 255);
if (!empty($data['fbc']) && is_string($data['fbc']))  $userData['fbc'] = substr($data['fbc'], 0, 255);

$customData = [];
if (isset($data['event_params']) && is_array($data['event_params'])) {
  foreach ($data['event_params'] as $k => $v) {
    if (is_scalar($v) && strlen((string)$k) > 0 && strlen((string)$k) <= 60) {
      $customData[(string)$k] = (string)$v;
    }
  }
}

$event = [
  'event_name'    => $eventName,
  'event_time'    => time(),
  'event_id'      => $eventId,
  'action_source' => 'website',
  'user_data'     => $userData,
];

if (isset($data['page_url']) && filter_var(substr((string)$data['page_url'], 0, 500), FILTER_VALIDATE_URL)) {
  $event['event_source_url'] = substr((string)$data['page_url'], 0, 500);
}
if (count($customData) > 0) {
  $event['custom_data'] = $customData;
}

$postFields = [
  'access_token' => $accessToken,
  'data'         => json_encode([$event]),
];
$testCode = getenv('TEST_EVENT_CODE');
if ($testCode) {
  $postFields['test_event_code'] = $testCode;
}

$ch = curl_init('https://graph.facebook.com/' . GRAPH_VERSION . '/' . FB_PIXEL_ID . '/events');
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => http_build_query($postFields),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT        => 10,
  CURLOPT_CONNECTTIMEOUT => 5,
  CURLOPT_SSL_VERIFYPEER => true,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
unset($ch); // PHP 8.5: curl_close() deprecated — initializer เอาไฟล์ทิ้งเมื่อจบ scope

exit(json_encode([
  'ok'   => $response !== false && $httpCode >= 200 && $httpCode < 300,
  'code' => $httpCode,
]));
