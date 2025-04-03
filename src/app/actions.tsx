'use server';

import { createStreamableValue } from 'ai/rsc';
import { CoreMessage, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Weather } from '@/components/weather';
import { generateText } from 'ai';
import { createStreamableUI } from 'ai/rsc';
import { ReactNode } from 'react';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'node-html-parser';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  display?: ReactNode;
}

interface DocumentMetadata {
  publisher_name: string;
  source_url: string;
  named_entities: {
    organizations: string[];
    persons: string[];
    locations: string[];
    dates: string[];
  };
  categories: string[];
  author: string;
}

interface SearchResult {
  id: number;
  content: string;
  similarity: number;
  created_at: string;
  publisher_name?: string;
  source_url?: string;
  named_entities?: Record<string, string[]>;
  categories?: string[];
  author?: string;
}

// Function to extract metadata using OpenAI
async function extractMetadata(content: string, url: string): Promise<DocumentMetadata> {
  const prompt = `
    Analyze this article and extract the following information in JSON format:
    1. Publisher name (from the URL or content)
    2. Author name (look for byline, author attribution)
    3. Named entities (organizations, persons, locations, dates mentioned)
    4. Categories (2-3 main topics)

    Article: ${content.substring(0, 1500)}...

    Respond only with JSON in this format:
    {
      "publisher_name": "string",
      "author": "string",
      "named_entities": {
        "organizations": ["string"],
        "persons": ["string"],
        "locations": ["string"],
        "dates": ["string"]
      },
      "categories": ["string"]
    }
  `;

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: [
      { role: 'system', content: 'You are a helpful assistant that extracts structured data from text.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
  });

  const metadata = JSON.parse(await result.text) as Omit<DocumentMetadata, 'source_url'>;
  
  return {
    ...metadata,
    source_url: url,
  };
}

// Function to extract readable text from HTML
function extractTextFromHtml(html: string, url: string): string {
  try {
    const root = parse(html);
    
    // Remove unwanted elements
    const removeSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      'aside',
      '.site-header',
      '.site-footer',
      '.nav',
      '.menu',
      '.sidebar',
      '.related',
      '.comments',
      '.advertisement',
      '.ad',
      '.social-share',
      'iframe',
      'noscript'
    ];
    
    removeSelectors.forEach(selector => {
      root.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Extract content based on the publisher
    const hostname = new URL(url).hostname;
    let content = '';
    
    if (hostname.includes('ithacavoice.org')) {
      const article = root.querySelector('.entry-content');
      if (article) {
        const title = root.querySelector('h1.entry-title');
        if (title) {
          content += title.textContent.trim() + '\n\n';
        }
        content += article.textContent;
      }
    }
    
    // Fallback to generic extraction
    if (!content) {
      const articleSelectors = [
        'article',
        '.article',
        '.post',
        '.entry-content',
        'main',
        '#main-content',
        '.main-content',
        '.article-content',
        '.post-content'
      ];
      
      for (const selector of articleSelectors) {
        const element = root.querySelector(selector);
        if (element) {
          content = element.textContent;
          if (content.length > 100) break;
        }
      }
      
      if (!content) {
        const bodyContent = root.querySelector('body');
        content = bodyContent ? bodyContent.textContent : root.textContent;
      }
    }
    
    // Clean up the content
    return content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
  } catch (error) {
    console.error('Error parsing HTML:', error);
    return '';
  }
}

// Function to generate embeddings using OpenAI
async function generateEmbedding(text: string) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-ada-002'
    })
  });

  const json = await response.json();
  return json.data[0].embedding;
}

// Function to search for relevant context using semantic search
async function getRelevantContext(query: string) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search for similar documents using vector similarity
    const { data: documents, error } = await supabase
      .rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.6,
        match_count: 3
      });

    if (error) {
      console.error('Search error:', error);
      return '';
    }

    if (documents && documents.length > 0) {
      console.log('Found matching documents:', documents.map((d: SearchResult) => ({
        id: d.id,
        publisher: d.publisher_name,
        author: d.author,
        url: d.source_url,
        similarity: d.similarity,
        categories: d.categories
      })));

      const contextParts = documents.map((doc: SearchResult) => {
        const date = new Date(doc.created_at).toLocaleDateString();
        const similarity = Math.round(doc.similarity * 100);
        
        // Format metadata
        const parts = [`[${date} | ${similarity}% relevance]`];
        
        // Add source info
        if (doc.source_url || doc.publisher_name) {
          const sourceInfo = [];
          if (doc.publisher_name) sourceInfo.push(doc.publisher_name);
          if (doc.author) sourceInfo.push(`by ${doc.author}`);
          if (doc.source_url) sourceInfo.push(`(${doc.source_url})`);
          parts.push(`Source: ${sourceInfo.join(' ')}`);
        }
        
        // Add categories
        if (doc.categories && doc.categories.length > 0) {
          parts.push(`Categories: ${doc.categories.join(', ')}`);
        }
        
        // Add content
        parts.push(doc.content);
        
        console.log('Document parts:', parts);
        return parts.join('\n');
      });

      // Sort by date, most recent first
      return contextParts.sort((a: string, b: string) => {
        const dateA = new Date(a.match(/\[(.*?)\|/)?.[1]?.trim() || '');
        const dateB = new Date(b.match(/\[(.*?)\|/)?.[1]?.trim() || '');
        return dateB.getTime() - dateA.getTime();
      }).join('\n\n');
    }

    return '';
  } catch (error) {
    console.error('Error in semantic search:', error);
    return '';
  }
}

// Streaming Chat 
export async function continueTextConversation(messages: CoreMessage[]) {
  // Get the user's latest message
  const latestMessage = messages[messages.length - 1];
  
  // Get relevant context
  const context = await getRelevantContext(latestMessage.content);
  
  // Prepare system message with context
  const systemMessage: CoreMessage = {
    role: 'system',
    content: `You are a helpful assistant. Use the following context to help answer the question. The context includes dates, relevance scores, sources, and categories - use this information to provide more complete answers. When citing information, mention the source. Here's the context:\n\n${context}`
  };

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: [systemMessage, ...messages],
  });

  const stream = createStreamableValue(result.textStream);
  return stream.value;
}

// Gen UIs 
export async function continueConversation(history: Message[]) {
  const stream = createStreamableUI();

  // Get the user's latest message
  const latestMessage = history[history.length - 1];
  
  // Get relevant context
  const context = await getRelevantContext(latestMessage.content);

  const { text, toolResults } = await generateText({
    model: openai('gpt-4o-mini'),
    system: `You are a friendly weather assistant. Use this context to help with current information: ${context}`,
    messages: history,
    tools: {
      showWeather: {
        description: 'Show the weather for a given location.',
        parameters: z.object({
          city: z.string().describe('The city to show the weather for.'),
          unit: z
            .enum(['F'])
            .describe('The unit to display the temperature in'),
        }),
        execute: async ({ city, unit }) => {
          stream.done(<Weather city={city} unit={unit} />);
          return `Here's the weather for ${city}!`; 
        },
      },
    },
  });

  return {
    messages: [
      ...history,
      {
        role: 'assistant' as const,
        content:
          text || toolResults.map(toolResult => toolResult.result).join(),
        display: stream.value,
      },
    ],
  };
}

// Test function for Supabase search
export async function testSupabaseSearch(query: string) {
  'use server';
  
  const { data: documents, error } = await supabase
    .from('documents')
    .select('content')
    .textSearch('content', query);

  if (error) {
    console.error('Search error:', error);
    return { error: error.message };
  }

  return { documents };
}

// Add new document to knowledge base
export async function addDocument(content: string) {
  'use server';
  
  const { data, error } = await supabase
    .from('documents')
    .insert([{ 
      content,
      created_at: new Date().toISOString()
    }])
    .select();

  if (error) {
    console.error('Insert error:', error);
    return { error: error.message };
  }

  return { success: true, document: data[0] };
}

// Add content from URL to knowledge base
export async function addContentFromUrl(url: string) {
  'use server';
  
  try {
    console.log('Fetching URL:', url);
    
    // Fetch content from URL with expanded headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': new URL(url).origin
      },
      next: { revalidate: 0 },
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('Fetch error:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error('URL does not return HTML content');
    }

    const html = await response.text();
    console.log('Raw HTML length:', html.length);
    
    if (!html) {
      return { error: 'Could not fetch content from URL' };
    }

    // Extract readable text from HTML
    const content = extractTextFromHtml(html, url);
    console.log('Extracted content length:', content.length);
    
    if (!content) {
      return { error: 'Could not extract readable content from URL' };
    }

    // Generate embedding for the content
    const embedding = await generateEmbedding(content);

    // Add to Supabase first with basic info
    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert([{ 
        content,
        embedding,
        source_url: url,
        created_at: new Date().toISOString()
      }])
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return { error: insertError.message };
    }

    // Start metadata extraction in background
    if (doc && doc[0]) {
      extractAndUpdateMetadata(doc[0].id, content, url).catch(console.error);
    }

    return { success: true, document: doc[0] };
  } catch (error) {
    console.error('URL fetch error:', error);
    return { error: error instanceof Error ? error.message : 'Failed to fetch or store content' };
  }
}

// Background metadata extraction
async function extractAndUpdateMetadata(docId: number, content: string, url: string) {
  try {
    console.log('Extracting metadata for document:', docId);
    const metadata = await extractMetadata(content, url);
    
    // Update document with metadata
    const { error } = await supabase
      .from('documents')
      .update({ 
        publisher_name: metadata.publisher_name,
        author: metadata.author,
        named_entities: metadata.named_entities,
        categories: metadata.categories
      })
      .eq('id', docId);

    if (error) {
      console.error('Metadata update error:', error);
    } else {
      console.log('Metadata updated successfully for document:', docId);
    }
  } catch (error) {
    console.error('Metadata extraction error:', error);
  }
}

// Delete document from knowledge base
export async function deleteDocument(id: number) {
  'use server';
  
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete error:', error);
    return { error: error.message };
  }

  return { success: true };
}

// Utils
export async function checkAIAvailability() {
  const envVarExists = !!process.env.OPENAI_API_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY;
  return envVarExists;
}