const successEnvelope = (dataSchema: object) => ({
  type: 'object',
  required: ['success', 'data', 'requestId'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: dataSchema,
    requestId: { $ref: '#/components/schemas/RequestId' },
  },
});

const pagedEnvelope = (itemSchema: object) => ({
  type: 'object',
  required: ['success', 'data', 'meta', 'requestId'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: { type: 'array', items: itemSchema },
    meta: { $ref: '#/components/schemas/Pagination' },
    requestId: { $ref: '#/components/schemas/RequestId' },
  },
});

const r200 = (schema: object, description = 'Success') => ({
  200: { description, content: { 'application/json': { schema } } },
});
const r201 = (schema: object, description = 'Created') => ({
  201: { description, content: { 'application/json': { schema } } },
});
const r400 = { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } } };
const r401 = { description: 'Unauthenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } } };
const r403 = { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } } };
const r404 = { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } } };
const r409 = { description: 'Conflict / invalid state transition', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } } };

const uuidParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description,
});

const paginationParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Bingo Platform API',
    version: '2.0.0',
    description:
      'REST + WebSocket API for the Bingo Platform. Includes categories, rounds (state machine), purchases, draws, win verification, and prize settlement. Real-money transactions are DISABLED — mock adapters only.',
    contact: { name: 'Bingo Platform Team' },
  },
  tags: [
    { name: 'Health', description: 'Service liveness and readiness checks' },
    { name: 'Bingo / Categories', description: 'Game category discovery' },
    { name: 'Bingo / Rounds', description: 'Round browse and state inspection' },
    { name: 'Bingo / Play', description: 'Authenticated player endpoints — purchase tickets, view cards, claim wins' },
    { name: 'Bingo / Admin', description: 'Admin-only endpoints — manage rounds, trigger draws, settle prizes' },
    { name: 'System', description: 'API documentation and metadata' },
  ],
  components: {
    securitySchemes: {
      playerBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Player JWT. In dev mode, supply `x-mock-player-id: <playerId>` header instead.',
      },
      adminToken: {
        type: 'apiKey',
        in: 'header',
        name: 'x-mock-admin-token',
        description: 'Dev-only admin secret. Value: `dev-admin-secret`. Blocked in production.',
      },
    },
    schemas: {
      RequestId: {
        type: 'string',
        description: 'Unique request identifier echoed from X-Request-Id header',
        example: 'a3bb189e-8bf9-3888-9912-ace4e6543002',
      },
      Pagination: {
        type: 'object',
        required: ['page', 'limit', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer', minimum: 1, example: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, example: 20 },
          total: { type: 'integer', minimum: 0, example: 42 },
          totalPages: { type: 'integer', minimum: 0, example: 3 },
        },
      },
      ErrorBody: {
        type: 'object',
        required: ['success', 'error', 'requestId'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'BingoRound not found' },
              details: { description: 'Zod validation details when present' },
            },
          },
          requestId: { $ref: '#/components/schemas/RequestId' },
        },
      },
      UserStatus: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'] },
      User: {
        type: 'object',
        required: ['id', 'username', 'status', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', example: 'jane_player' },
          email: { type: ['string', 'null'], format: 'email' },
          status: { $ref: '#/components/schemas/UserStatus' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      RoundStatus: {
        type: 'string',
        enum: ['SCHEDULED', 'OPEN_FOR_SALE', 'SALES_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        description: 'State machine: SCHEDULED → OPEN_FOR_SALE → SALES_CLOSED → IN_PROGRESS → COMPLETED. CANCELLED reachable from any state.',
      },
      BingoCategory: {
        type: 'object',
        required: ['id', 'name', 'slug', 'isActive', 'priceMinorUnits', 'currency', 'maxTicketsPerPurchase'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Daily Special' },
          slug: { type: 'string', example: 'daily-special' },
          description: { type: ['string', 'null'] },
          isActive: { type: 'boolean' },
          priceMinorUnits: { type: 'integer', description: 'Ticket price in minor currency units (e.g. KES cents)', example: 5000 },
          currency: { type: 'string', example: 'KES' },
          maxTicketsPerPurchase: { type: 'integer', example: 10 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      BingoPrizeRule: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          pattern: { type: 'object', description: 'JSON describing win pattern (e.g. {type:"ANY_ROW"})' },
          prizeAmountMinorUnits: { type: 'integer' },
          currency: { type: 'string' },
          maxWinners: { type: ['integer', 'null'] },
        },
      },
      BingoRound: {
        type: 'object',
        required: ['id', 'categoryId', 'status', 'scheduledStart', 'maxTickets', 'totalTickets'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid' },
          category: { $ref: '#/components/schemas/BingoCategory' },
          status: { $ref: '#/components/schemas/RoundStatus' },
          scheduledStart: { type: 'string', format: 'date-time' },
          salesDeadline: { type: ['string', 'null'], format: 'date-time' },
          startedAt: { type: ['string', 'null'], format: 'date-time' },
          completedAt: { type: ['string', 'null'], format: 'date-time' },
          cancelledAt: { type: ['string', 'null'], format: 'date-time' },
          cancellationReason: { type: ['string', 'null'] },
          maxTickets: { type: 'integer' },
          totalTickets: { type: 'integer' },
          prizeRules: { type: 'array', items: { $ref: '#/components/schemas/BingoPrizeRule' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      BingoRoundState: {
        type: 'object',
        required: ['id', 'status', 'totalTickets', 'drawCount'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: { $ref: '#/components/schemas/RoundStatus' },
          totalTickets: { type: 'integer' },
          version: { type: 'integer' },
          drawCount: { type: 'integer' },
          lastDrawnNumber: { type: ['integer', 'null'], minimum: 1, maximum: 75 },
          lastDrawnAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      ReconcileResult: {
        type: 'object',
        properties: {
          purchaseId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['CONFIRMED', 'FAILED', 'PENDING'] },
          reconciled: { type: 'boolean' },
          walletStatus: { type: 'string' },
          reason: { type: 'string', description: 'Set when reconciled=false, e.g. "not_pending"' },
        },
      },
      BingoCard: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          ticketId: { type: 'string', format: 'uuid' },
          numbers: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 25,
            maxItems: 25,
            description: 'Row-major flat array. Index 12 = FREE cell (0). B:1-15, I:16-30, N:31-45, G:46-60, O:61-75.',
          },
        },
      },
      BingoTicket: {
        type: 'object',
        required: ['id', 'roundId', 'purchaseId', 'playerId', 'serialNumber', 'isVoid'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          roundId: { type: 'string', format: 'uuid' },
          purchaseId: { type: 'string', format: 'uuid' },
          playerId: { type: 'string' },
          serialNumber: { type: 'string', example: 'BNG-A3BB189E-1234ABCD' },
          isVoid: { type: 'boolean' },
          card: { $ref: '#/components/schemas/BingoCard' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PurchaseStatus: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED'] },
      BingoPurchase: {
        type: 'object',
        required: ['id', 'roundId', 'playerId', 'status', 'ticketCount', 'totalAmount', 'currency'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          roundId: { type: 'string', format: 'uuid' },
          playerId: { type: 'string' },
          status: { $ref: '#/components/schemas/PurchaseStatus' },
          ticketCount: { type: 'integer' },
          pricePerTicket: { type: 'integer' },
          totalAmount: { type: 'integer', description: 'Minor currency units' },
          currency: { type: 'string', example: 'KES' },
          idempotencyKey: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          tickets: { type: 'array', items: { $ref: '#/components/schemas/BingoTicket' } },
        },
      },
      BingoDrawEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          roundId: { type: 'string', format: 'uuid' },
          number: { type: 'integer', minimum: 1, maximum: 75 },
          sequence: { type: 'integer', minimum: 1 },
          drawnBy: { type: 'string' },
          drawnAt: { type: 'string', format: 'date-time' },
        },
      },
      BingoAdminReports: {
        type: 'object',
        properties: {
          totalRounds: { type: 'integer' },
          totalPurchases: { type: 'integer' },
          totalTickets: { type: 'integer' },
          totalCategories: { type: 'integer' },
          pendingPurchases: { type: 'integer', description: 'Purchases awaiting wallet reconciliation' },
        },
      },
    },
  },
  paths: {
    '/api/v1/health': {
      get: {
        summary: 'Liveness check',
        tags: ['Health'],
        operationId: 'liveness',
        responses: {
          ...r200(successEnvelope({ type: 'object', properties: { status: { type: 'string', example: 'ok' } } })),
        },
      },
    },
    '/api/v1/health/live': {
      get: {
        summary: 'Liveness check (alias)',
        description: 'Alias for GET /api/v1/health. Does NOT check external dependencies.',
        tags: ['Health'],
        operationId: 'liveness_alias',
        responses: { ...r200(successEnvelope({ type: 'object', properties: { status: { type: 'string', example: 'ok' } } })) },
      },
    },
    '/api/v1/health/ready': {
      get: {
        summary: 'Readiness check',
        description: 'Verifies PostgreSQL and Redis connectivity. Returns 503 if either is unavailable.',
        tags: ['Health'],
        operationId: 'readiness',
        responses: {
          ...r200(successEnvelope({ type: 'object', properties: { database: { type: 'boolean' }, redis: { type: 'boolean' }, ready: { type: 'boolean' } } })),
          503: { description: 'Dependency unavailable', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } } },
        },
      },
    },
    // ── Categories ─────────────────────────────────────────────────────────
    '/api/v1/bingo/categories': {
      get: {
        summary: 'List categories',
        description: 'Returns active game categories by default. Pass `activeOnly=false` to include inactive ones.',
        tags: ['Bingo / Categories'],
        operationId: 'listCategories',
        parameters: [
          { name: 'activeOnly', in: 'query', schema: { type: 'boolean', default: true } },
        ],
        responses: { ...r200(successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/BingoCategory' } })) },
      },
    },
    '/api/v1/bingo/categories/{categoryId}': {
      get: {
        summary: 'Get category',
        tags: ['Bingo / Categories'],
        operationId: 'getCategory',
        parameters: [uuidParam('categoryId', 'Category UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoCategory' })), 400: r400, 404: r404 },
      },
    },
    '/api/v1/bingo/categories/{categoryId}/rounds': {
      get: {
        summary: 'List rounds for a category',
        tags: ['Bingo / Categories'],
        operationId: 'getCategoryRounds',
        parameters: [uuidParam('categoryId', 'Category UUID'), ...paginationParams],
        responses: { ...r200(pagedEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 404: r404 },
      },
    },

    // ── Rounds (public) ────────────────────────────────────────────────────
    '/api/v1/bingo/rounds': {
      get: {
        summary: 'List rounds',
        tags: ['Bingo / Rounds'],
        operationId: 'listRounds',
        parameters: [
          ...paginationParams,
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/RoundStatus' } },
          { name: 'categoryId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { ...r200(pagedEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400 },
      },
    },
    '/api/v1/bingo/rounds/{roundId}': {
      get: {
        summary: 'Get round',
        tags: ['Bingo / Rounds'],
        operationId: 'getRound',
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 404: r404 },
      },
    },
    '/api/v1/bingo/rounds/{roundId}/state': {
      get: {
        summary: 'Live round state (draw cursor)',
        description: 'Lightweight poll — returns current status and draw count without full round payload.',
        tags: ['Bingo / Rounds'],
        operationId: 'getRoundState',
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRoundState' })), 400: r400, 404: r404 },
      },
    },
    '/api/v1/bingo/rounds/{roundId}/numbers': {
      get: {
        summary: 'Draw history',
        description: 'Returns all numbers drawn so far, in draw order.',
        tags: ['Bingo / Rounds'],
        operationId: 'getRoundNumbers',
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/BingoDrawEvent' } })), 400: r400, 404: r404 },
      },
    },
    '/api/v1/bingo/rounds/{roundId}/winners': {
      get: {
        summary: 'Round winners',
        tags: ['Bingo / Rounds'],
        operationId: 'getRoundWinners',
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ type: 'array', items: { type: 'object' } })), 400: r400, 404: r404 },
      },
    },
    '/api/v1/bingo/rounds/{roundId}/results': {
      get: {
        summary: 'Round final results',
        tags: ['Bingo / Rounds'],
        operationId: 'getRoundResults',
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ type: 'object' })), 400: r400, 404: r404 },
      },
    },

    // ── Authenticated player endpoints ─────────────────────────────────────
    '/api/v1/bingo/rounds/{roundId}/purchases': {
      post: {
        summary: 'Purchase tickets',
        description: '**Real-money DISABLED** — uses mock wallet adapter. Idempotency key prevents duplicate purchases.',
        tags: ['Bingo / Play'],
        operationId: 'createPurchase',
        security: [{ playerBearer: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ticketCount', 'idempotencyKey'],
                properties: {
                  ticketCount: { type: 'integer', minimum: 1, maximum: 20, example: 3 },
                  idempotencyKey: { type: 'string', minLength: 16, maxLength: 64, description: 'Caller-generated unique key; same key returns the original purchase' },
                },
              },
            },
          },
        },
        responses: { ...r201(successEnvelope({ $ref: '#/components/schemas/BingoPurchase' })), 400: r400, 401: r401, 404: r404, 409: r409 },
      },
    },
    '/api/v1/bingo/purchases/{purchaseId}': {
      get: {
        summary: 'Get purchase',
        description: 'Returns purchase with embedded ticket list. Only accessible by the purchasing player.',
        tags: ['Bingo / Play'],
        operationId: 'getPurchase',
        security: [{ playerBearer: [] }],
        parameters: [uuidParam('purchaseId', 'Purchase UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoPurchase' })), 400: r400, 401: r401, 403: r403, 404: r404 },
      },
    },
    '/api/v1/bingo/tickets/{ticketId}': {
      get: {
        summary: 'Get ticket',
        tags: ['Bingo / Play'],
        operationId: 'getTicket',
        security: [{ playerBearer: [] }],
        parameters: [uuidParam('ticketId', 'Ticket UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoTicket' })), 400: r400, 401: r401, 403: r403, 404: r404 },
      },
    },
    '/api/v1/bingo/tickets/{ticketId}/card': {
      get: {
        summary: 'Get ticket bingo card',
        description: 'Returns the 25-number card layout for a specific ticket.',
        tags: ['Bingo / Play'],
        operationId: 'getTicketCard',
        security: [{ playerBearer: [] }],
        parameters: [uuidParam('ticketId', 'Ticket UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoCard' })), 400: r400, 401: r401, 403: r403, 404: r404 },
      },
    },
    '/api/v1/bingo/tickets/{ticketId}/wins': {
      get: {
        summary: 'Get wins for a ticket',
        tags: ['Bingo / Play'],
        operationId: 'getTicketWins',
        security: [{ playerBearer: [] }],
        parameters: [uuidParam('ticketId', 'Ticket UUID')],
        responses: { ...r200(successEnvelope({ type: 'array', items: { type: 'object' } })), 401: r401, 403: r403, 404: r404 },
      },
    },
    '/api/v1/bingo/me/tickets': {
      get: {
        summary: 'My tickets',
        tags: ['Bingo / Play'],
        operationId: 'listMyTickets',
        security: [{ playerBearer: [] }],
        parameters: paginationParams,
        responses: { ...r200(pagedEnvelope({ $ref: '#/components/schemas/BingoTicket' })), 401: r401 },
      },
    },
    '/api/v1/bingo/me/purchases': {
      get: {
        summary: 'My purchases',
        tags: ['Bingo / Play'],
        operationId: 'listMyPurchases',
        security: [{ playerBearer: [] }],
        parameters: paginationParams,
        responses: { ...r200(pagedEnvelope({ $ref: '#/components/schemas/BingoPurchase' })), 401: r401 },
      },
    },
    '/api/v1/bingo/me/wins': {
      get: {
        summary: 'My win claims',
        tags: ['Bingo / Play'],
        operationId: 'listMyWins',
        security: [{ playerBearer: [] }],
        parameters: paginationParams,
        responses: { ...r200(pagedEnvelope({ type: 'object' })), 401: r401 },
      },
    },
    '/api/v1/bingo/me/prizes': {
      get: {
        summary: 'My prize allocations',
        tags: ['Bingo / Play'],
        operationId: 'listMyPrizes',
        security: [{ playerBearer: [] }],
        parameters: paginationParams,
        responses: { ...r200(pagedEnvelope({ type: 'object' })), 401: r401 },
      },
    },
    '/api/v1/bingo/history': {
      get: {
        summary: 'My bingo history',
        tags: ['Bingo / Play'],
        operationId: 'getBingoHistory',
        security: [{ playerBearer: [] }],
        parameters: paginationParams,
        responses: { ...r200(pagedEnvelope({ type: 'object' })), 401: r401 },
      },
    },

    // ── Admin endpoints ────────────────────────────────────────────────────
    '/api/v1/admin/bingo/categories': {
      get: {
        summary: 'Admin: list all categories',
        tags: ['Bingo / Admin'],
        operationId: 'adminListCategories',
        security: [{ adminToken: [] }],
        responses: { ...r200(successEnvelope({ type: 'array', items: { $ref: '#/components/schemas/BingoCategory' } })), 403: r403 },
      },
      post: {
        summary: 'Admin: create category',
        tags: ['Bingo / Admin'],
        operationId: 'adminCreateCategory',
        security: [{ adminToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'slug', 'priceMinorUnits'],
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  description: { type: 'string' },
                  priceMinorUnits: { type: 'integer', minimum: 1 },
                  currency: { type: 'string', default: 'KES' },
                  maxTicketsPerPurchase: { type: 'integer', minimum: 1, default: 10 },
                },
              },
            },
          },
        },
        responses: { ...r201(successEnvelope({ $ref: '#/components/schemas/BingoCategory' })), 400: r400, 403: r403 },
      },
    },
    '/api/v1/admin/bingo/categories/{categoryId}': {
      patch: {
        summary: 'Admin: update category',
        tags: ['Bingo / Admin'],
        operationId: 'adminUpdateCategory',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('categoryId', 'Category UUID')],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' }, isActive: { type: 'boolean' }, priceMinorUnits: { type: 'integer' } } },
            },
          },
        },
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoCategory' })), 400: r400, 403: r403, 404: r404 },
      },
    },
    '/api/v1/admin/bingo/rounds': {
      get: {
        summary: 'Admin: list rounds',
        tags: ['Bingo / Admin'],
        operationId: 'adminListRounds',
        security: [{ adminToken: [] }],
        parameters: paginationParams,
        responses: { ...r200(pagedEnvelope({ $ref: '#/components/schemas/BingoRound' })), 403: r403 },
      },
      post: {
        summary: 'Admin: schedule new round',
        tags: ['Bingo / Admin'],
        operationId: 'adminCreateRound',
        security: [{ adminToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['categoryId', 'scheduledStart', 'maxTickets'],
                properties: {
                  categoryId: { type: 'string', format: 'uuid' },
                  scheduledStart: { type: 'string', format: 'date-time' },
                  salesDeadline: { type: 'string', format: 'date-time' },
                  maxTickets: { type: 'integer', minimum: 1 },
                  prizeRules: { type: 'array', items: { type: 'object' } },
                },
              },
            },
          },
        },
        responses: { ...r201(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 403: r403 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}': {
      get: {
        summary: 'Admin: get round',
        tags: ['Bingo / Admin'],
        operationId: 'adminGetRound',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 403: r403, 404: r404 },
      },
      patch: {
        summary: 'Admin: update round (SCHEDULED only)',
        tags: ['Bingo / Admin'],
        operationId: 'adminUpdateRound',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { scheduledStart: { type: 'string', format: 'date-time' }, salesDeadline: { type: 'string', format: 'date-time' }, maxTickets: { type: 'integer' } } },
            },
          },
        },
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 403: r403, 404: r404, 409: r409 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}/open-sales': {
      post: {
        summary: 'Admin: open ticket sales',
        description: 'Transitions SCHEDULED → OPEN_FOR_SALE.',
        tags: ['Bingo / Admin'],
        operationId: 'adminOpenSales',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 403: r403, 404: r404, 409: r409 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}/close-sales': {
      post: {
        summary: 'Admin: close ticket sales',
        description: 'Transitions OPEN_FOR_SALE → SALES_CLOSED.',
        tags: ['Bingo / Admin'],
        operationId: 'adminCloseSales',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 403: r403, 404: r404, 409: r409 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}/start': {
      post: {
        summary: 'Admin: start round (begin drawing)',
        description: 'Transitions SALES_CLOSED → IN_PROGRESS.',
        tags: ['Bingo / Admin'],
        operationId: 'adminStartRound',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 403: r403, 404: r404, 409: r409 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}/cancel': {
      post: {
        summary: 'Admin: cancel round',
        description: 'Transitions any non-terminal state → CANCELLED. Reason is required.',
        tags: ['Bingo / Admin'],
        operationId: 'adminCancelRound',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 1 } } },
            },
          },
        },
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 403: r403, 404: r404, 409: r409 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}/complete': {
      post: {
        summary: 'Admin: complete round',
        description: 'Transitions IN_PROGRESS → COMPLETED. Call after verify-wins and settle.',
        tags: ['Bingo / Admin'],
        operationId: 'adminCompleteRound',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 400: r400, 403: r403, 404: r404, 409: r409 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}/draw': {
      post: {
        summary: 'Admin: draw next number',
        description: 'Draws a random unrepeated number 1–75. Round must be IN_PROGRESS.',
        tags: ['Bingo / Admin'],
        operationId: 'adminDrawNumber',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r201(successEnvelope({ $ref: '#/components/schemas/BingoDrawEvent' })), 400: r400, 403: r403, 404: r404, 409: r409 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}/verify-wins': {
      post: {
        summary: 'Admin: verify and claim wins',
        description: 'Scans all tickets for winning patterns against drawn numbers. Idempotent.',
        tags: ['Bingo / Admin'],
        operationId: 'adminVerifyWins',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ type: 'object' })), 403: r403, 404: r404 },
      },
    },
    '/api/v1/admin/bingo/rounds/{roundId}/settle': {
      post: {
        summary: 'Admin: settle prize allocations',
        description: '**Mock only** — calls mock wallet credit adapter. Real money DISABLED.',
        tags: ['Bingo / Admin'],
        operationId: 'adminSettle',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ type: 'object' })), 403: r403, 404: r404 },
      },
    },
    '/api/v1/admin/bingo/purchases/{purchaseId}/reconcile': {
      post: {
        summary: 'Admin: reconcile a PENDING purchase',
        description: 'Queries the wallet adapter for the final outcome of a PENDING transaction. Updates purchase status to CONFIRMED or FAILED. Voids all tickets if FAILED. Idempotent — non-PENDING purchases return immediately.',
        tags: ['Bingo / Admin'],
        operationId: 'adminReconcilePurchase',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('purchaseId', 'Purchase UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/ReconcileResult' })), 400: r400, 403: r403, 404: r404, 409: r409 },
      },
    },
    '/api/v1/admin/bingo/reports': {
      get: {
        summary: 'Admin: platform aggregate counts',
        tags: ['Bingo / Admin'],
        operationId: 'adminReports',
        security: [{ adminToken: [] }],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoAdminReports' })), 403: r403 },
      },
    },
    '/api/v1/admin/bingo/audit-events': {
      get: {
        summary: 'Admin: audit log',
        tags: ['Bingo / Admin'],
        operationId: 'adminAuditEvents',
        security: [{ adminToken: [] }],
        parameters: [
          ...paginationParams,
          { name: 'roundId', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Filter by round' },
        ],
        responses: { ...r200(pagedEnvelope({ type: 'object' })), 400: r400, 403: r403 },
      },
    },
    '/api/v1/admin/bingo/results/{roundId}': {
      get: {
        summary: 'Admin: round results (alias)',
        description: 'Alias for GET /api/v1/admin/bingo/rounds/{roundId}.',
        tags: ['Bingo / Admin'],
        operationId: 'adminGetRoundResults',
        security: [{ adminToken: [] }],
        parameters: [uuidParam('roundId', 'Round UUID')],
        responses: { ...r200(successEnvelope({ $ref: '#/components/schemas/BingoRound' })), 403: r403, 404: r404 },
      },
    },
    '/api/docs': {
      get: {
        summary: 'Swagger UI',
        tags: ['System'],
        operationId: 'swaggerUi',
        responses: { 200: { description: 'Interactive API documentation' } },
      },
    },
    '/api/openapi.json': {
      get: {
        summary: 'Raw OpenAPI 3.1.0 specification',
        tags: ['System'],
        operationId: 'openapiSpec',
        responses: { 200: { description: 'JSON specification document' } },
      },
    },
  },
};
