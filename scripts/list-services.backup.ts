import 'cross-fetch/polyfill';

async function main() {
  console.log('Fetching available 0g Service Market providers...');

  try {
    // This URL is an example — we will update to the actual marketplace endpoint
    const response = await fetch('https://serving-market.api.0g.ai/providers');
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const data = await response.json();

    console.log(`Found ${data.length} providers:`);
    data.forEach((provider: any, index: number) => {
      console.log(`${index + 1}. ${provider.name || provider.id}`);
      if (provider.models) {
        console.log(`   Models: ${provider.models.map((m: any) => m.name).join(', ')}`);
      }
    });
  } catch (error) {
    console.error('Error listing services:', error);
  }
}

main();
