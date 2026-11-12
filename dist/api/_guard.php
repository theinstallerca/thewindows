<?php
// Shared anti-spam checks for the contact and estimate handlers.
// All checks are invisible to normal visitors. Call guard() after the method check.

declare(strict_types=1);

function guard_fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function guard(array $textFields = ['message', 'notes']): void {
    // 1. Honeypot — bots fill every field.
    if (!empty($_POST['website'])) { echo json_encode(['ok' => true]); exit; }

    // 2. Must come from our JS (fetch sets this header; plain POST tools usually don't).
    if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'thewindows') guard_fail(400, 'Bad request');

    // 3. Same-origin only.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
    if ($origin !== '' && !preg_match('#^https?://(www\.)?thewindows\.ca(/|$)#i', $origin)) guard_fail(403, 'Forbidden');

    // 4. Timing — form must have been open at least 4 s (bots submit instantly).
    $ts = (int)($_POST['ts'] ?? 0);
    $age = time() - intdiv($ts, 1000);
    if ($ts === 0 || $age < 4 || $age > 86400) guard_fail(400, 'Please try again');

    // 5. Content heuristics — links and spammy patterns in free text.
    foreach ($textFields as $f) {
        $v = (string)($_POST[$f] ?? '');
        if (preg_match_all('#https?://|www\.#i', $v) > 1) guard_fail(400, 'Too many links');
        if (preg_match('#\[url=|\[link=|<a\s#i', $v)) guard_fail(400, 'Not allowed');
    }
    $name = (string)($_POST['name'] ?? '');
    if (preg_match('#https?://|\.(com|net|ru|xyz)\b#i', $name)) guard_fail(400, 'Not allowed');

    // 6. Rate limit — max 5 submissions per IP per hour (file-based, no database).
    $ip  = $_SERVER['REMOTE_ADDR'] ?? '0';
    $dir = sys_get_temp_dir() . '/thewindows-rl';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $file = $dir . '/' . hash('sha256', $ip);
    $now = time();
    $hits = is_file($file) ? array_filter(array_map('intval', file($file, FILE_IGNORE_NEW_LINES)), fn($t) => $now - $t < 3600) : [];
    if (count($hits) >= 5) guard_fail(429, 'Too many requests, please try later');
    $hits[] = $now;
    @file_put_contents($file, implode("\n", $hits));
}
