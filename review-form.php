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

if (!empty($_POST['website_hp'] ?? '')) {
    respond(true, 'Review received.');
}

$name = trim((string)($_POST['name'] ?? ''));
$project = trim((string)($_POST['project'] ?? ''));
$review = trim((string)($_POST['review'] ?? ''));

if (mb_strlen($name) < 2) {
    respond(false, 'Please enter your name.');
}
if (mb_strlen($project) < 2) {
    respond(false, 'Please enter your project or business name.');
}
if (mb_strlen($review) < 10) {
    respond(false, 'Please write a review of at least 10 characters.');
}

$safeName = str_replace(["\r", "\n"], '', $name);
$to = 'seo@service.lk';
$subject = 'New customer review from ' . $safeName;
$body = "New customer review from seoservice.lk\n\n";
$body .= "Name: $name\n";
$body .= "Project: $project\n\n";
$body .= "Review:\n$review\n";
$headers = "From: SEOSERVICE.LK Website <seo@service.lk>\r\n";
$headers .= "Reply-To: seo@service.lk\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

if (mail($to, $subject, $body, $headers)) {
    respond(true, 'Thank you. Your review has been sent successfully.');
}

respond(false, 'Something went wrong sending your review. Please try again.');
