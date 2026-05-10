/**
 * Extrai a identidade do WhatsApp (Telefone ou LID) de forma robusta
 */

export interface WhatsAppIdentity {
  phone: string | null;
  lid: string | null;
  jid: string | null;
  pushName: string | null;
}

export interface JidResolution {
  contactJid: string | null;
  reason: string;
  fromMe: boolean;
}

/**
 * Resolve o JID do contato real baseado no payload da Evolution API
 */
export function resolveContactJidFromEvolutionPayload(body: any): JidResolution {
  const data = body?.data;
  const key = data?.key;
  const fromMe = key?.fromMe === true || data?.fromMe === true;
  const instanceNumber = body?.sender;

  let contactJid: string | null = null;
  let reason = "unknown";

  const remoteJid = key?.remoteJid || data?.remoteJid;
  const participant = key?.participant || data?.participant;

  if (fromMe) {
    contactJid = remoteJid;
    reason = "sent_message_using_remote_jid";
  } else {
    if (remoteJid?.includes('@g.us')) {
      contactJid = participant || remoteJid;
      reason = "received_group_message_using_participant";
    } else {
      contactJid = remoteJid;
      reason = "received_direct_message_using_remote_jid";
    }
  }

  if (contactJid && instanceNumber && contactJid === instanceNumber) {
    reason += "_instance_match_warning";
  }

  return { contactJid, reason, fromMe };
}

/**
 * Extrai a identidade (phone ou lid) a partir de um JID ou payload
 */
export function extractWhatsAppIdentity(payload: any): WhatsAppIdentity {
  const resolution = resolveContactJidFromEvolutionPayload(payload);
  const rawJid = resolution.contactJid;
  const pushName = payload.pushName || payload.notifyName || payload.data?.pushName;

  if (!rawJid) {
    return { phone: null, lid: null, jid: null, pushName: null };
  }

  const identity: WhatsAppIdentity = {
    jid: rawJid,
    phone: null,
    lid: null,
    pushName: typeof pushName === 'string' ? pushName : null
  };

  // Lógica de Identidade Híbrida
  if (isLid(rawJid)) {
    identity.lid = rawJid.replace('@lid', '');
    // Busca agressiva pelo número real em campos que representam o PARTICIPANTE (GUEST)
    const possibleSenderFields = [
      payload.data?.key?.participant,
      payload.data?.participant
    ];

    for (const s of possibleSenderFields) {
      if (s && typeof s === 'string' && isWhatsappPhoneJid(s)) {
        const extractedPhone = normalizeBrazilianPhone(s.split('@')[0]);
        // Se o número extraído for o da própria pousada, ignoramos para não dar loop
        if (extractedPhone && extractedPhone !== process.env.POUSADA_PHONE) {
          identity.phone = extractedPhone;
          if (identity.phone) break; 
        }
      }
    }
  } else if (isWhatsappPhoneJid(rawJid)) {
    const rawPhone = rawJid.split('@')[0];
    identity.phone = normalizeBrazilianPhone(rawPhone);
  }

  return identity;
}

/**
 * Normaliza telefone brasileiro para formato E.164 básico (apenas números)
 * Garante que comece com 55 se parecer um número BR
 */
export function normalizeBrazilianPhone(input: string): string | null {
  if (!input) return null;
  
  // Remove tudo que não é dígito
  const clean = input.replace(/\D/g, '');

  if (!clean) return null;

  // Se já começa com 55 e tem tamanho razoável (12 ou 13 dígitos)
  if (clean.startsWith('55') && (clean.length === 12 || clean.length === 13)) {
    return clean;
  }

  // Se tem 10 ou 11 dígitos e não começa com 55, assume que é BR e adiciona 55
  if (clean.length === 10 || clean.length === 11) {
    return `55${clean}`;
  }

  // Fallback: retorna apenas os dígitos se não se encaixar no padrão BR óbvio
  return clean;
}

/**
 * Verifica se um JID é do tipo LID
 */
export function isLid(jid: string): boolean {
  return typeof jid === 'string' && jid.includes('@lid');
}

/**
 * Verifica se um JID é um telefone tradicional do WhatsApp
 */
export function isWhatsappPhoneJid(jid: string): boolean {
  return typeof jid === 'string' && (jid.includes('@s.whatsapp.net') || jid.includes('@c.us'));
}
