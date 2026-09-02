<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

function respond(bool $success, string $message): void {
    http_response_code($success ? 200 : 400);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Invalid request method.');
}

// Honeypot: real visitors never fill this hidden field.
if (!empty($_POST['website_hp'] ?? '')) {
    respond(true, 'Request received.');
}

$whatsapp = trim((string)($_POST['whatsapp'] ?? ''));
$url      = trim((string)($_POST['url'] ?? ''));
$keyword  = trim((string)($_POST['keyword'] ?? ''));
$mode     = trim((string)($_POST['mode'] ?? ''));

$whatsappDigits = preg_replace('/[^0-9+]/', '', $whatsapp) ?? '';
if (!preg_match('/^\+?[0-9]{7,15}$/', $whatsappDigits)) {
    respond(false, 'Please enter a valid WhatsApp number.');
}

$modeLabel = $mode === 'html' ? 'Pasted HTML source' : 'Website URL';
$targetLine = $mode === 'html' ? 'Pasted HTML source (not a live URL)' : ($url !== '' ? $url : '(not provided)');

$to      = 'contact@seoservice.lk';
$subject = 'Free SEO Checker Lead — ' . $whatsappDigits;

$body  = "A visitor ran the Free SEO Checker on seoservice.lk and left their WhatsApp number.\n\n";
$body .= "WhatsApp Number: $whatsappDigits\n";
$body .= "Analysis Type: $modeLabel\n";
$body .= "Target: $targetLine\n";
$body .= "Target Keyword: " . ($keyword !== '' ? $keyword : '(none provided)') . "\n";
$body .= "Submitted: " . gmdate('Y-m-d H:i:s') . " UTC\n";

$headers  = "From: SEOSERVICE.LK Website <contact@seoservice.lk>\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

if (mail($to, $subject, $body, $headers)) {
    respond(true, 'Lead received.');
} else {
    respond(false, 'Could not send lead notification.');
}
