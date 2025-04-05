# NewsChat

An AI-powered knowledge base for news articles with advanced search and chat capabilities.

# URLs

/test -- adding stuff

## Features

- Add news articles via URL
- Extract article metadata (publisher, author, categories)
- Semantic search across articles
- Chat interface with context-aware responses
- Vector-based similarity matching
- Modern, responsive UI

## Tech Stack

- Next.js 14
- OpenAI API
- Supabase (PostgreSQL with pgvector)
- TypeScript
- Tailwind CSS

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and add your API keys
3. Install dependencies: `npm install`
4. Run the development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Required environment variables in `.env`:
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
