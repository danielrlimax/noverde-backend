import sanitizeHtml from 'sanitize-html';
import xss from 'xss';

/**
 * Configuração padrão para sanitização de HTML
 */
const htmlSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  allowedAttributes: {
    a: ['href', 'title', 'target'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'discard',
};

/**
 * Configuração restritiva (remove todo HTML)
 */
const strictSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

/**
 * Sanitiza HTML permitindo apenas tags seguras
 */
export function sanitizeHTML(input: string): string {
  return sanitizeHtml(input, htmlSanitizeOptions);
}

/**
 * Remove todo HTML e scripts (para campos de texto simples)
 */
export function sanitizeText(input: string): string {
  return sanitizeHtml(input, strictSanitizeOptions).trim();
}

/**
 * Sanitiza contra XSS
 */
export function sanitizeXSS(input: string): string {
  return xss(input);
}

/**
 * Sanitiza um e-mail
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Sanitiza um número de telefone (mantém apenas números)
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Sanitiza um slug (URL-friendly)
 */
export function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '-') // Espaços para hífens
    .replace(/-+/g, '-') // Múltiplos hífens para um
    .replace(/^-|-$/g, ''); // Remove hífens no início/fim
}

/**
 * Sanitiza objeto recursivamente
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeText(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Valida e sanitiza IP
 */
export function sanitizeIP(ip: string | undefined): string | null {
  if (!ip) return null;
  
  // Remove prefixo IPv6 se for IPv4 mapeado
  const cleanIP = ip.replace(/^::ffff:/, '');
  
  // Validação básica de IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // Validação básica de IPv6
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  if (ipv4Regex.test(cleanIP) || ipv6Regex.test(cleanIP)) {
    return cleanIP;
  }
  
  return null;
}

/**
 * Trunca texto com segurança
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
