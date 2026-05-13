import { body, param, query, ValidationChain } from 'express-validator';

/**
 * Validadores reutilizáveis
 */
export const validators = {
  // Campos comuns
  email: () =>
    body('email')
      .trim()
      .toLowerCase()
      .isEmail()
      .withMessage('E-mail inválido')
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage('E-mail muito longo'),

  password: () =>
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Senha deve ter entre 8 e 128 caracteres')
      .matches(/[a-z]/)
      .withMessage('Senha deve conter pelo menos uma letra minúscula')
      .matches(/[A-Z]/)
      .withMessage('Senha deve conter pelo menos uma letra maiúscula')
      .matches(/[0-9]/)
      .withMessage('Senha deve conter pelo menos um número')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Senha deve conter pelo menos um caractere especial'),

  name: () =>
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Nome é obrigatório')
      .isLength({ min: 2, max: 100 })
      .withMessage('Nome deve ter entre 2 e 100 caracteres')
      .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
      .withMessage('Nome deve conter apenas letras'),

  phone: () =>
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Telefone é obrigatório')
      .matches(/^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/)
      .withMessage('Telefone inválido'),

  phoneOptional: () =>
    body('phone')
      .optional()
      .trim()
      .matches(/^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/)
      .withMessage('Telefone inválido'),

  message: () =>
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Mensagem é obrigatória')
      .isLength({ min: 10, max: 5000 })
      .withMessage('Mensagem deve ter entre 10 e 5000 caracteres'),

  messageOptional: () =>
    body('message')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Mensagem deve ter no máximo 5000 caracteres'),

  // Simulador
  monthlyBill: () =>
    body('monthly_bill')
      .isFloat({ min: 50, max: 100000 })
      .withMessage('Conta de luz deve estar entre R$ 50 e R$ 100.000'),

  roofArea: () =>
    body('roof_area')
      .isFloat({ min: 5, max: 10000 })
      .withMessage('Área do telhado deve estar entre 5 e 10.000 m²'),

  region: () =>
    body('region')
      .trim()
      .isIn(['norte', 'nordeste', 'centro-oeste', 'sudeste', 'sul'])
      .withMessage('Região inválida'),

  // Tipo de projeto
  projectType: () =>
    body('project_type')
      .trim()
      .isIn(['residencial', 'comercial', 'industrial', 'rural', 'outro'])
      .withMessage('Tipo de projeto inválido'),

  // UUID
  uuid: (field: string = 'id') =>
    param(field)
      .isUUID(4)
      .withMessage('ID inválido'),

  uuidBody: (field: string) =>
    body(field)
      .optional()
      .isUUID(4)
      .withMessage(`${field} inválido`),

  // Paginação
  page: () =>
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Página deve ser um número positivo')
      .toInt(),

  limit: () =>
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limite deve estar entre 1 e 100')
      .toInt(),

  // Blog
  title: () =>
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Título é obrigatório')
      .isLength({ min: 5, max: 200 })
      .withMessage('Título deve ter entre 5 e 200 caracteres'),

  slug: () =>
    body('slug')
      .optional()
      .trim()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug deve conter apenas letras minúsculas, números e hífens')
      .isLength({ max: 200 })
      .withMessage('Slug muito longo'),

  content: () =>
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Conteúdo é obrigatório')
      .isLength({ min: 50 })
      .withMessage('Conteúdo deve ter pelo menos 50 caracteres'),

  excerpt: () =>
    body('excerpt')
      .trim()
      .notEmpty()
      .withMessage('Resumo é obrigatório')
      .isLength({ min: 20, max: 500 })
      .withMessage('Resumo deve ter entre 20 e 500 caracteres'),

  // Status
  leadStatus: () =>
    body('status')
      .isIn(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])
      .withMessage('Status de lead inválido'),

  blogStatus: () =>
    body('status')
      .isIn(['draft', 'published', 'archived'])
      .withMessage('Status de post inválido'),

  // Subject (Contato)
  subject: () =>
    body('subject')
      .trim()
      .notEmpty()
      .withMessage('Assunto é obrigatório')
      .isLength({ min: 3, max: 200 })
      .withMessage('Assunto deve ter entre 3 e 200 caracteres'),
};

/**
 * Schemas de validação compostos
 */
export const validationSchemas = {
  // Autenticação
  login: [
    validators.email(),
    body('password').notEmpty().withMessage('Senha é obrigatória'),
  ],

  register: [
    validators.name(),
    validators.email(),
    validators.password(),
  ],

  changePassword: [
    body('current_password').notEmpty().withMessage('Senha atual é obrigatória'),
    validators.password().withMessage('Nova senha inválida'),
  ],

  forgotPassword: [
    validators.email(),
  ],

  resetPassword: [
    body('token').notEmpty().withMessage('Token é obrigatório'),
    validators.password(),
  ],

  // Leads
  createLead: [
    validators.name(),
    validators.email(),
    validators.phone(),
    validators.projectType(),
    validators.messageOptional(),
    body('monthly_bill').optional().isFloat({ min: 0 }).withMessage('Valor inválido'),
    body('roof_area').optional().isFloat({ min: 0 }).withMessage('Área inválida'),
    body('region').optional().trim(),
    body('source').optional().trim().isLength({ max: 100 }),
  ],

  updateLead: [
    validators.uuid(),
    validators.leadStatus().optional(),
    body('assigned_to').optional().isUUID(4).withMessage('ID de usuário inválido'),
    body('notes').optional().trim().isLength({ max: 5000 }),
  ],

  // Simulação
  createSimulation: [
    validators.monthlyBill(),
    validators.roofArea(),
    validators.region(),
    body('session_id').optional().trim().isLength({ max: 100 }),
  ],

  // Contato
  createContact: [
    validators.name(),
    validators.email(),
    validators.phoneOptional(),
    validators.subject(),
    validators.message(),
  ],

  // Blog
  createPost: [
    validators.title(),
    validators.slug(),
    validators.excerpt(),
    validators.content(),
    body('category_id').isUUID(4).withMessage('Categoria inválida'),
    validators.blogStatus().optional(),
  ],

  updatePost: [
    validators.uuid(),
    validators.title().optional(),
    validators.slug(),
    validators.excerpt().optional(),
    validators.content().optional(),
    body('category_id').optional().isUUID(4).withMessage('Categoria inválida'),
    validators.blogStatus().optional(),
  ],

  // Newsletter
  subscribeNewsletter: [
    validators.email(),
    body('name').optional().trim().isLength({ max: 100 }),
  ],

  // Paginação
  pagination: [
    validators.page(),
    validators.limit(),
  ],
};

export type ValidationSchema = ValidationChain[];
