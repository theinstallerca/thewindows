<?php
// Contact form handler for thewindows.ca
// Sends the submission by email using the server's mail() (cPanel sendmail).

declare(strict_types=1);

$TO       = 'info@thewindows.ca';        // where submissions go
$FROM     = 'noreply@thewindows.ca';     // must be an address on this domain for deliverability
$SUBJECT  = 'Quote request from thewindows.ca';

header('Content-Type: application/json; charset=utf-8');

function fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Method not allowed');
}

// Honeypot: bots fill every field.
if (!empty($_POST['website'])) {
    echo json_encode(['ok' => true]); // pretend success, discard
    exit;
}

$clean = static function (string $key, int $max = 500): string {
    $v = trim((string)($_POST[$key] ?? ''));
    $v = str_replace(["\r", "\n"], ' ', $v);
    return mb_substr($v, 0, $max);
};

$name    = $clean('name', 100);
$email   = $clean('email', 150);
$phone   = $clean('phone', 40);
$address = $clean('address', 200);
$count   = $clean('count', 10);
$project = $clean('project', 60);
$message = mb_substr(trim((string)($_POST['message'] ?? '')), 0, 3000);
$lang    = ($clean('lang', 5) === 'uk') ? 'UA' : 'EN';

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail(400, 'Name and a valid email are required');
}

$body  = "New quote request from thewindows.ca\n\n";
$body .= "Name:     $name\n";
$body .= "Email:    $email\n";
$body .= "Phone:    $phone\n";
$body .= "Address:  $address\n";
$body .= "Windows:  $count\n";
$body .= "Project:  $project\n\n";
$body .= "Details:\n$message\n\n";
$body .= "---\nIP: " . ($_SERVER['REMOTE_ADDR'] ?? '') . "\nTime: " . date('Y-m-d H:i:s') . "\n";

$headers  = "From: The Windows website <$FROM>\r\n";
$headers .= "Reply-To: $name <$email>\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = mail($TO, "[$lang] $SUBJECT", $body, $headers, "-f$FROM");

if (!$sent) {
    fail(500, 'Mail could not be sent');
}

echo json_encode(['ok' => true]);
