<?php
declare(strict_types=1);

/**
 * HTTP layer ONLY: check the method, read the request, call the service,
 * translate the outcome into a status code + JSON. No rules, no SQL.
 */
final class DealController
{
    private const MAX_BODY_BYTES = 10240; // a valid ask is well under 1 KB

    public function __construct(private readonly DealService $service)
    {
    }

    /** GET /api/deals/list.php[?type=Equity|Loan|Grant|All] */
    public function list(): never
    {
        $this->requireMethod('GET');

        $type = $_GET['type'] ?? null;
        if ($type !== null && !is_string($type)) {
            Response::error(400, 'bad_request', 'type must be a single value.');
        }

        try {
            $deals = $this->service->listDeals($type);
        } catch (InvalidArgumentException $e) {
            Response::error(400, 'bad_request', $e->getMessage());
        }

        Response::json(200, ['data' => $deals]);
    }

    /** POST /api/deals/create.php  (JSON body) */
    public function create(): never
    {
        $this->requireMethod('POST');
        $input = $this->readJsonBody();

        try {
            $deal = $this->service->createDeal($input);
        } catch (ValidationException $e) {
            Response::error(422, 'validation', 'Some fields need attention.', ['fields' => $e->fields]);
        }

        Response::json(201, ['data' => $deal]);
    }

    private function requireMethod(string $expected): void
    {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== $expected) {
            Response::error(405, 'method_not_allowed', "Use {$expected} for this endpoint.", [], ['Allow' => $expected . ', OPTIONS']);
        }
    }

    /** @return array<string,mixed> */
    private function readJsonBody(): array
    {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') !== 0) {
            Response::error(415, 'unsupported_media_type', 'Send the body as application/json.');
        }

        $raw = file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);
        if ($raw === false || $raw === '') {
            Response::error(400, 'bad_request', 'Request body is empty.');
        }
        if (strlen($raw) > self::MAX_BODY_BYTES) {
            Response::error(413, 'payload_too_large', 'Request body is too large.');
        }

        $data = json_decode($raw, true, 8);
        // Must be a JSON object ({}), not a list, string or number.
        if (!is_array($data) || ($data !== [] && array_is_list($data))) {
            Response::error(400, 'bad_request', 'Request body must be a JSON object.');
        }
        return $data;
    }
}
