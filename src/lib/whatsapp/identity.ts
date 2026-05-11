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
 * Regra: Se fromMe=true, o contato é o destinatário (remoteJid).
 *       Se fromMe=false, o contato é o remetente (remoteJid ou participant em grupos).
 */
export function resolveContactJidFromEvolutionPayload(body: any): JidResolution {
  const data = body?.data;
  const key = data?.key;
  const fromMe = key?.fromMe === true;
  const instanceNumber = body?.sender; // Geralmente o número da instância na v2

  let contactJid: string | null = null;
  let reason = "unknown";

  // 1. Extração primária
  const remoteJid = key?.remoteJid || data?.remoteJid;
  const participant = key?.participant || data?.participant;

  if (fromMe) {
    // Mensagem enviada por mim: o contato é o destinatário (remoteJid)
    contactJid = remoteJid;
    reason = "sent_message_using_remote_jid";
  } else {
    // Mensagem recebida: 
    // Em grupos, preferir participant. Em 1:1, usar remoteJid.
    if (remoteJid?.includes('@g.us')) {
      contactJid = participant || remoteJid;
      reason = "received_group_message_using_participant";
    } else {
      contactJid = remoteJid;
      reason = "received_direct_message_using_remote_jid";
    }
  }

  // 2. Proteção contra número da própria instância
  if (contactJid && instanceNumber && contactJid === instanceNumber) {
    console.warn("[WEBHOOK IDENTITY WARNING] Detectada tentativa de usar número da instância como contato.", {
      contactJid,
      instanceNumber
    });
    // Se for igual, e for mensagem recebida, pode ser uma mensagem "para si mesmo" 
    // ou erro no payload. Vamos manter, mas logar o aviso.
    reason += "_instance_match_warning";
  }

  return { contactJid, reason, fromMe };
}

export function extractWhatsAppIdentity(payload: any): WhatsAppIdentity {
  // Resolve o JID correto usando a nova lógica
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

  if (rawJid.includes('@lid')) {
    identity.lid = rawJid.replace('@lid', '');
  } else if (rawJid.includes('@s.whatsapp.net') || rawJid.includes('@c.us')) {
    identity.phone = rawJid.split('@')[0].replace(/\D/g, '');
  }

  return identity;
}
