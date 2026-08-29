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

// Honeypot: real visitors never fill this hidden field. Bots that do get a
// fake success so they don't know they were blocked, but no mail is sent.
if (!empty($_POST['website_hp'] ?? '')) {
    respond(true, 'Request received.');
}

$name    = trim((string)($_POST['name'] ?? ''));
$email   = trim((string)($_POST['email'] ?? ''));
$url     = trim((string)($_POST['url'] ?? ''));
$goal    = trim((string)($_POST['goal'] ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

if (mb_strlen($name) < 2) {
    respond(false, 'Please enter your name.');
}

$email = str_replace(["\r", "\n"], '', $email);
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Please enter a valid email address.');
}

if ($url === '' || !filter_var(str_starts_with($url, 'http') ? $url : "https://$url", FILTER_VALIDATE_URL)) {
    respond(false, 'Please enter a valid website URL.');
}

$goalLabels = [
    'rankings'   => 'Dominate #1 Google Search Rankings',
    'traffic'    => 'Increase Organic Traffic & Leads',
    'technical'  => 'Fix Technical SEO & Core Web Vitals',
    'ai-geo'     => 'Prepare for AI Overviews / GEO Search',
    'local'      => 'Local Map Pack Dominance (Sri Lanka)',
];
$goalLabel = $goalLabels[$goal] ?? 'Not specified';

$to      = 'contact@seoservice.lk';
$subject = 'New SEO Audit Request from ' . str_replace(["\r", "\n"], '', $name);

$body  = "New free SEO audit request from seoservice.lk\n\n";
$body .= "Name: $name\n";
$body .= "Email: $email\n";
$body .= "Website: $url\n";
$body .= "Primary Objective: $goalLabel\n";
$body .= "Message:\n" . ($message !== '' ? $message : '(none provided)') . "\n";

$headers  = "From: SEOSERVICE.LK Website <contact@seoservice.lk>\r\n";
$headers .= "Reply-To: $name <$email>\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

if (mail($to, $subject, $body, $headers)) {
    respond(true, 'Request received! We will prepare your audit and contact you shortly.');
} else {
    respond(false, 'Something went wrong sending your request. Please email contact@seoservice.lk directly.');
}
