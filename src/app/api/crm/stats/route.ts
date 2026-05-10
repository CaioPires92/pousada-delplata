import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // 1. Contagem por Estágio
    const stagesCount = await prisma.pipelineCard.groupBy({
      by: ['stage'],
      _count: {
        _all: true
      }
    });

    // 2. Contagem por Origem (do Contato)
    const sourcesCount = await prisma.contact.groupBy({
      by: ['source'],
      _count: {
        _all: true
      }
    });

    // 3. Valor Estimado Total (Pipeline Ativa)
    const activeValue = await prisma.pipelineCard.aggregate({
      where: {
        stage: {
          notIn: ['fechado', 'perdido']
        }
      },
      _sum: {
        estimatedValue: true
      }
    });

    // 4. Valor Fechado (Sucesso)
    const closedValue = await prisma.pipelineCard.aggregate({
      where: {
        stage: 'fechado'
      },
      _sum: {
        estimatedValue: true
      }
    });

    // 5. Total de Leads
    const totalLeads = await prisma.pipelineCard.count();

    // 6. Cálculo de SLA (Tempo Médio de Resposta)
    const conversations = await prisma.conversation.findMany({
      where: {
        messages: {
          some: { senderType: 'admin' }
        }
      },
      include: {
        messages: {
          orderBy: { sentAt: 'asc' },
          take: 50
        }
      }
    });

    let totalResponseTime = 0;
    let respondedConversations = 0;

    for (const conv of conversations) {
      const firstContactMsg = conv.messages.find(m => m.senderType === 'contact');
      const firstAdminMsg = conv.messages.find(m => m.senderType === 'admin');

      if (firstContactMsg && firstAdminMsg && firstAdminMsg.sentAt > firstContactMsg.sentAt) {
        totalResponseTime += firstAdminMsg.sentAt.getTime() - firstContactMsg.sentAt.getTime();
        respondedConversations++;
      }
    }

    const avgResponseTimeMin = respondedConversations > 0 
      ? (totalResponseTime / respondedConversations) / (1000 * 60) 
      : 0;

    return NextResponse.json({
      ok: true,
      stats: {
        totalLeads,
        byStage: stagesCount.map(s => ({ stage: s.stage, count: s._count._all })),
        bySource: sourcesCount.map(s => ({ source: s.source, count: s._count._all })),
        activeValue: activeValue._sum.estimatedValue || 0,
        closedValue: closedValue._sum.estimatedValue || 0,
        avgResponseTime: avgResponseTimeMin,
        conversionRate: totalLeads > 0 
          ? ((stagesCount.find(s => s.stage === 'fechado')?._count._all || 0) / totalLeads) * 100 
          : 0
      }
    });
  } catch (error) {
    console.error("Erro ao gerar estatísticas do CRM:", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
