const CAMPAIGN_STORAGE_KEY = 'delplata_campaign_attribution';

export const CAMPAIGN_PARAM_NAMES = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'gbraid', 'wbraid', 'msclkid',
] as const;

type SearchParamsReader = Pick<URLSearchParams, 'get'>;

function collectCampaignParams(searchParams: SearchParamsReader) {
    const campaign = new URLSearchParams();
    for (const name of CAMPAIGN_PARAM_NAMES) {
        const value = String(searchParams.get(name) || '').trim();
        if (value) campaign.set(name, value.slice(0, 250));
    }
    return campaign;
}

export function captureCampaignAttribution(searchParams: SearchParamsReader) {
    const campaign = collectCampaignParams(searchParams);
    if (campaign.size === 0 || typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(CAMPAIGN_STORAGE_KEY, campaign.toString());
    } catch {
        // Storage can be unavailable in privacy modes; the current URL still works.
    }
}

export function appendCampaignAttribution(target: URLSearchParams, searchParams: SearchParamsReader) {
    const current = collectCampaignParams(searchParams);
    let stored = new URLSearchParams();
    if (typeof window !== 'undefined') {
        try {
            stored = new URLSearchParams(window.sessionStorage.getItem(CAMPAIGN_STORAGE_KEY) || '');
        } catch {
            // Continue with current query parameters only.
        }
    }

    for (const name of CAMPAIGN_PARAM_NAMES) {
        const value = current.get(name) || stored.get(name);
        if (value && !target.has(name)) target.set(name, value);
    }
    if (current.size > 0) captureCampaignAttribution(searchParams);
    return target;
}
