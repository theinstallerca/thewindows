<?php
// Online estimate request handler for thewindows.ca
// Receives window parameters + PNG previews, emails the shop (with attachments) and a copy to the customer.

declare(strict_types=1);

$TO      = 'info@thewindows.ca';
$FROM    = 'noreply@thewindows.ca';
$MAX_WIN = 20;

header('Content-Type: application/json; charset=utf-8');

function fail(int $code, string $msg): void { http_response_code($code); echo json_encode(['ok' => false, 'error' => $msg]); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Method not allowed');
if (!empty($_POST['website'])) { echo json_encode(['ok' => true]); exit; } // honeypot

$clean = static function (string $key, int $max = 500): string {
    $v = trim((string)($_POST[$key] ?? ''));
    return mb_substr(str_replace(["\r", "\n"], ' ', $v), 0, $max);
};
$name    = $clean('name', 100);
$email   = $clean('email', 150);
$wall    = $clean('wall', 10);
if ($wall === 'custom') $wall = 'custom: ' . $clean('wall_custom', 40);
$unit    = $clean('unit', 2) === 'cm' ? 'cm' : 'in';
$lang    = $clean('lang', 5) === 'uk' ? 'UA' : 'EN';
$notes   = mb_substr(trim((string)($_POST['notes'] ?? '')), 0, 3000);

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Name and a valid email are required');

$wins = json_decode((string)($_POST['windows'] ?? '[]'), true);
if (!is_array($wins) || count($wins) === 0) fail(400, 'No windows');
$wins = array_slice($wins, 0, $MAX_WIN);

$typeNames = ['casementL' => 'Casement LH', 'casementR' => 'Casement RH', 'awning' => 'Awning', 'picture' => 'Picture', 'none' => '-'];
$esc = static fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');

// ---- Build HTML summary -------------------------------------------------
$rows = '';
$textRows = '';
foreach ($wins as $i => $w) {
    $n = $i + 1;
    $types = implode(' | ', array_map(fn($t) => $typeNames[$t] ?? '-', (array)($w['types'] ?? [])));
    $glass = ($w['glass'] ?? '') === 'triple' ? 'Triple' : 'Dual';
    $opts  = [];
    if (!empty($w['lowe']))   $opts[] = 'Low-E';
    if (!empty($w['argon']))  $opts[] = 'Argon';
    if (!empty($w['grilles'])) $opts[] = 'Grilles';
    $wt = $esc($w['w_text'] ?? $w['w'] ?? '');
    $ht = $esc($w['h_text'] ?? $w['h'] ?? '');
    $qty = (int)($w['qty'] ?? 1);
    $rows .= "<tr><td>$n</td><td>$qty</td><td>$wt × $ht</td><td>" . (int)($w['sections'] ?? 1) . "</td><td>{$esc($types)}</td><td>$glass " . $esc(implode(', ', $opts)) . "</td></tr>";
    $textRows .= "#$n qty $qty — $wt x $ht — " . (int)($w['sections'] ?? 1) . " sec: $types — $glass " . implode(', ', $opts) . "\n";
}

$table = "<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px'>
<tr style='background:#f2f2f2'><th>#</th><th>Qty</th><th>W × H</th><th>Sections</th><th>Types (L→R)</th><th>Glass</th></tr>$rows</table>";

$shopHtml = "<p><b>Online estimate request [$lang]</b> from thewindows.ca</p>
<p><b>Name:</b> {$esc($name)}<br><b>Email:</b> {$esc($email)}<br><b>Wall thickness:</b> {$esc($wall)}<br><b>Units entered:</b> $unit</p>
$table
<p><b>Notes:</b><br>" . nl2br($esc($notes)) . "</p>
<p style='color:#888;font-size:11px'>IP: " . $esc($_SERVER['REMOTE_ADDR'] ?? '') . " · " . date('Y-m-d H:i') . "</p>";

$custHtml = $lang === 'UA'
    ? "<p>Вітаємо, {$esc($name)}!</p><p>Ми отримали ваш запит на орієнтовний розрахунок і відповімо на цей email з орієнтовною ціною, зазвичай протягом одного робочого дня. Якщо ціна підійде — приїдемо на безкоштовний замір.</p>$table<p>Це орієнтовна ціна; остаточна підтверджується після заміру.</p><p>The Windows · Вінніпег · (204) 230-8145 · info@thewindows.ca</p>"
    : "<p>Hi {$esc($name)},</p><p>We received your online estimate request and will reply to this email with a budgetary price, usually within one business day. If it fits your budget, we'll come out for a free measurement.</p>$table<p>This is a budgetary estimate; the final price is confirmed after on-site measurement.</p><p>The Windows · Winnipeg · (204) 230-8145 · info@thewindows.ca</p>";

// ---- Attachments ------------------------------------------------------
$attachments = [];
if (!empty($_FILES['preview']) && is_array($_FILES['preview']['tmp_name'])) {
    foreach ($_FILES['preview']['tmp_name'] as $i => $tmp) {
        if (!is_uploaded_file($tmp) || $_FILES['preview']['size'][$i] > 2_000_000) continue;
        $data = file_get_contents($tmp);
        if (substr($data, 0, 8) !== "\x89PNG\r\n\x1a\n") continue; // must be a PNG
        $attachments[] = ['name' => 'window-' . ($i + 1) . '.png', 'data' => $data];
        if (count($attachments) >= $MAX_WIN) break;
    }
}

// ---- Send (multipart MIME) --------------------------------------------
function sendMail(string $to, string $subject, string $html, array $attachments, string $from, string $replyTo = ''): bool {
    $b = 'b' . bin2hex(random_bytes(12));
    $h  = "From: The Windows website <$from>\r\n";
    if ($replyTo) $h .= "Reply-To: $replyTo\r\n";
    $h .= "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"$b\"\r\n";
    $body  = "--$b\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n$html\r\n";
    foreach ($attachments as $a) {
        $body .= "--$b\r\nContent-Type: image/png; name=\"{$a['name']}\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"{$a['name']}\"\r\n\r\n" . chunk_split(base64_encode($a['data'])) . "\r\n";
    }
    $body .= "--$b--\r\n";
    $subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    return mail($to, $subject, $body, $h, "-f$from");
}

$sentShop = sendMail($TO, "[$lang] Online estimate request — $name", $shopHtml, $attachments, $FROM, "$name <$email>");
if (!$sentShop) fail(500, 'Mail could not be sent');
sendMail($email, $lang === 'UA' ? 'Ваш запит на розрахунок — The Windows' : 'Your estimate request — The Windows', $custHtml, $attachments, $FROM, $TO);

echo json_encode(['ok' => true]);
