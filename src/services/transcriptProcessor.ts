export interface TranscriptMetadata {
  wordCount: number;
  estimatedDuration: number;
  complexity: 'simple' | 'medium' | 'complex';
  sentiment: 'positive' | 'neutral' | 'concerned';
  keywords: string[];
}

export interface ExtractedEntities {
  monetary_values: Array<{ value: number; context: string }>;
  dates_mentioned: Array<{ date: string; context: string }>;
  financial_products: string[];
  problems_identified: string[];
  commitments_made: string[];
}

export interface StructuredTranscript {
  introduction: string;
  body: string;
  conclusion: string;
  main_topics: string[];
}

export interface ProcessedTranscript {
  cleaned_text: string;
  structure: StructuredTranscript;
  entities: ExtractedEntities;
  metadata: TranscriptMetadata;
  embedding_ready_text: string;
}

export function cleanTranscript(text: string): string {
  let cleaned = text;

  cleaned = cleaned.replace(/\b(ééé|ããã|hmmm|uhh|ahh)\b/gi, '');
  cleaned = cleaned.replace(/(\b\w+\b)(\s+\1)+/g, '$1');
  cleaned = cleaned.replace(/(\.\s*){2,}/g, '. ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\[(\d{2}:)?\d{2}:\d{2}\]/g, '');
  cleaned = cleaned.replace(/\b(e\.\.\.|\.\.\.e)\b/gi, '');
  cleaned = cleaned.trim();

  return cleaned;
}

export function analyzeStructure(text: string): StructuredTranscript {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const totalSentences = sentences.length;

  const introEnd = Math.floor(totalSentences * 0.1);
  const bodyEnd = Math.floor(totalSentences * 0.9);

  const introduction = sentences.slice(0, introEnd).join('. ') + '.';
  const body = sentences.slice(introEnd, bodyEnd).join('. ') + '.';
  const conclusion = sentences.slice(bodyEnd).join('. ') + '.';

  const topicIndicators = [
    'vamos falar sobre',
    'precisamos discutir',
    'gostaria de abordar',
    'importante mencionar',
    'em relação a',
    'sobre o tema',
  ];

  const main_topics: string[] = [];
  const lowerText = text.toLowerCase();

  topicIndicators.forEach(indicator => {
    const regex = new RegExp(`${indicator}\\s+([^.!?]{10,60})`, 'gi');
    const matches = lowerText.matchAll(regex);
    for (const match of matches) {
      if (match[1]) {
        main_topics.push(match[1].trim());
      }
    }
  });

  return {
    introduction,
    body,
    conclusion,
    main_topics: Array.from(new Set(main_topics)).slice(0, 5),
  };
}

export function extractEntities(text: string): ExtractedEntities {
  const monetaryPattern = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*(mil|milhão|milhões|bilhão|bilhões)?/gi;
  const monetary_values: Array<{ value: number; context: string }> = [];

  let match;
  while ((match = monetaryPattern.exec(text)) !== null) {
    const valueStr = match[1].replace(/\./g, '').replace(',', '.');
    let value = parseFloat(valueStr);

    const multiplier = match[2]?.toLowerCase();
    if (multiplier === 'mil') value *= 1000;
    else if (multiplier === 'milhão' || multiplier === 'milhões') value *= 1000000;
    else if (multiplier === 'bilhão' || multiplier === 'bilhões') value *= 1000000000;

    const startPos = Math.max(0, match.index - 50);
    const endPos = Math.min(text.length, match.index + 100);
    const context = text.substring(startPos, endPos).trim();

    monetary_values.push({ value, context });
  }

  const datePattern = /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\s+de\s+\w+(?:\s+de\s+\d{4})?|próxim[oa]|semana\s+que\s+vem|mês\s+que\s+vem)/gi;
  const dates_mentioned: Array<{ date: string; context: string }> = [];

  let dateMatch;
  while ((dateMatch = datePattern.exec(text)) !== null) {
    const startPos = Math.max(0, dateMatch.index - 40);
    const endPos = Math.min(text.length, dateMatch.index + 80);
    const context = text.substring(startPos, endPos).trim();

    dates_mentioned.push({ date: dateMatch[0], context });
  }

  const productKeywords = [
    'seguro de vida',
    'seguro residencial',
    'seguro auto',
    'previdência privada',
    'previdência',
    'fundo de investimento',
    'CDB',
    'LCI',
    'LCA',
    'tesouro direto',
    'ações',
    'fundos imobiliários',
    'renda fixa',
    'renda variável',
  ];

  const financial_products: string[] = [];
  const lowerText = text.toLowerCase();

  productKeywords.forEach(product => {
    if (lowerText.includes(product)) {
      financial_products.push(product);
    }
  });

  const problemIndicators = [
    /(?:problema|dificuldade|preocupação)\s+(?:com|em|sobre)\s+([^.!?]{10,80})/gi,
    /não\s+(?:consigo|consegue|sei)\s+([^.!?]{10,60})/gi,
    /(?:está|estou|ficou)\s+(?:complicado|difícil|confuso)\s+([^.!?]{10,60})/gi,
  ];

  const problems_identified: string[] = [];

  problemIndicators.forEach(pattern => {
    let problemMatch;
    while ((problemMatch = pattern.exec(text)) !== null) {
      if (problemMatch[1]) {
        problems_identified.push(problemMatch[1].trim());
      }
    }
  });

  const commitmentIndicators = [
    /vou\s+([^.!?]{10,60})/gi,
    /vamos\s+([^.!?]{10,60})/gi,
    /preciso\s+([^.!?]{10,60})/gi,
    /tem\s+que\s+([^.!?]{10,60})/gi,
  ];

  const commitments_made: string[] = [];

  commitmentIndicators.forEach(pattern => {
    let commitmentMatch;
    while ((commitmentMatch = pattern.exec(text)) !== null) {
      if (commitmentMatch[1]) {
        const commitment = commitmentMatch[1].trim();
        if (commitment.length >= 15) {
          commitments_made.push(commitment);
        }
      }
    }
  });

  return {
    monetary_values: monetary_values.slice(0, 10),
    dates_mentioned: dates_mentioned.slice(0, 8),
    financial_products: Array.from(new Set(financial_products)),
    problems_identified: Array.from(new Set(problems_identified)).slice(0, 5),
    commitments_made: Array.from(new Set(commitments_made)).slice(0, 8),
  };
}

export function generateMetadata(text: string, entities: ExtractedEntities): TranscriptMetadata {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  const wordsPerMinute = 150;
  const estimatedDuration = Math.ceil(wordCount / wordsPerMinute);

  let complexity: 'simple' | 'medium' | 'complex' = 'medium';
  if (entities.financial_products.length === 0 && entities.monetary_values.length < 3) {
    complexity = 'simple';
  } else if (entities.financial_products.length > 3 && entities.monetary_values.length > 5) {
    complexity = 'complex';
  }

  const positiveWords = ['bom', 'ótimo', 'excelente', 'feliz', 'satisfeito', 'tranquilo', 'seguro'];
  const concernWords = ['preocupado', 'difícil', 'problema', 'complicado', 'confuso', 'inseguro', 'medo'];

  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;
  const concernCount = concernWords.filter(w => lowerText.includes(w)).length;

  let sentiment: 'positive' | 'neutral' | 'concerned' = 'neutral';
  if (positiveCount > concernCount && positiveCount >= 2) {
    sentiment = 'positive';
  } else if (concernCount > positiveCount && concernCount >= 2) {
    sentiment = 'concerned';
  }

  const commonWords = new Set(['o', 'a', 'de', 'da', 'do', 'e', 'em', 'para', 'com', 'que', 'um', 'uma']);
  const wordFreq: Record<string, number> = {};

  words.forEach(word => {
    const lower = word.toLowerCase().replace(/[^a-zà-ú]/g, '');
    if (lower.length > 4 && !commonWords.has(lower)) {
      wordFreq[lower] = (wordFreq[lower] || 0) + 1;
    }
  });

  const keywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  return {
    wordCount,
    estimatedDuration,
    complexity,
    sentiment,
    keywords,
  };
}

export function prepareForEmbedding(
  originalText: string,
  processed: ProcessedTranscript,
  meetingType: string,
  clientName: string,
  meetingDate: string,
  summary?: string,
  decisions?: string[]
): string {
  const parts: string[] = [];

  parts.push(`TIPO DE REUNIÃO: ${meetingType}`);
  parts.push(`CLIENTE: ${clientName}`);
  parts.push(`DATA: ${meetingDate}`);
  parts.push('');

  if (summary) {
    parts.push('RESUMO:');
    parts.push(summary);
    parts.push('');
  }

  if (decisions && decisions.length > 0) {
    parts.push('DECISÕES TOMADAS:');
    decisions.forEach((decision, i) => {
      parts.push(`${i + 1}. ${decision}`);
    });
    parts.push('');
  }

  if (processed.entities.financial_products.length > 0) {
    parts.push('PRODUTOS MENCIONADOS:');
    parts.push(processed.entities.financial_products.join(', '));
    parts.push('');
  }

  if (processed.entities.problems_identified.length > 0) {
    parts.push('PROBLEMAS IDENTIFICADOS:');
    processed.entities.problems_identified.forEach((problem, i) => {
      parts.push(`${i + 1}. ${problem}`);
    });
    parts.push('');
  }

  parts.push('TRANSCRIÇÃO COMPLETA:');
  parts.push(processed.cleaned_text);
  parts.push('');

  parts.push(`COMPLEXIDADE: ${processed.metadata.complexity}`);
  parts.push(`SENTIMENTO: ${processed.metadata.sentiment}`);
  parts.push(`PALAVRAS-CHAVE: ${processed.metadata.keywords.join(', ')}`);

  return parts.join('\n');
}

export function processTranscript(text: string): ProcessedTranscript {
  const cleaned_text = cleanTranscript(text);

  const structure = analyzeStructure(cleaned_text);

  const entities = extractEntities(cleaned_text);

  const metadata = generateMetadata(cleaned_text, entities);

  const embedding_ready_text = cleaned_text;

  return {
    cleaned_text,
    structure,
    entities,
    metadata,
    embedding_ready_text,
  };
}
