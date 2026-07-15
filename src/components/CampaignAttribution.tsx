'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { captureCampaignAttribution } from '@/lib/campaign-attribution';

export default function CampaignAttribution() {
    const searchParams = useSearchParams();

    useEffect(() => {
        captureCampaignAttribution(searchParams);
    }, [searchParams]);

    return null;
}
