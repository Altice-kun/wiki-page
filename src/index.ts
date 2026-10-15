import { encryptWithAEA } from './crypto';
import { pushMarkdownToGitHub } from './github';

export interface Env {
  DB: D1Database;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  GITHUB_TOKEN: string; // Wrangler Secrets等で設定
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORSヘッダー
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Local-Passcode',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. ユーザー登録エンドポイント
      if (path === '/api/register' && method === 'POST') {
        const body: any = await request.json();
        const { mcid, display_name, password } = body;
        const localPasscode = request.headers.get('X-Local-Passcode');

        if (!mcid || !password || !localPasscode || localPasscode.length !== 4) {
          return Response.json({ error: 'Invalid parameters or local passcode (must be 4 digits)' }, { status: 400, headers: corsHeaders });
        }

        // AEAアルゴリズムによる暗号化の適用
        const encryptedPassword = encryptWithAEA(password, localPasscode);
        const createdAt = new Date().toISOString();

        await env.DB.prepare(
          `INSERT INTO users (mcid, display_name, password, created_at) VALUES (?, ?, ?, ?)`
        ).bind(mcid.toLowerCase(), display_name || mcid, encryptedPassword, createdAt).run();

        return Response.json({ success: true, message: 'User registered successfully with AEA encryption.' }, { headers: corsHeaders });
      }

      // 2. 記事作成・編集およびGitHub Pushエンドポイント
      if (path === '/api/wiki/save' && method === 'POST') {
        const body: any = await request.json();
        const { slug, title, content, author_mcid } = body;

        if (!slug || !title || !content || !author_mcid) {
          return Response.json({ error: 'Missing required article fields' }, { status: 400, headers: corsHeaders });
        }

        const updatedAt = new Date().toISOString();

        // D1データベースへ保存
        await env.DB.prepare(
          `INSERT INTO pages (slug, title, content, author_mcid, updated_at) 
           VALUES (?, ?, ?, ?, ?) 
           ON CONFLICT(slug) DO UPDATE SET title = ?, content = ?, author_mcid = ?, updated_at = ?`
        ).bind(slug, title, content, author_mcid, updatedAt, title, content, author_mcid, updatedAt).run();

        // GitHubリポジトリへMarkdownファイルをPush
        const filePath = `content/${slug}.md`;
        const commitMessage = `[Wiki] Update article: ${slug} by ${author_mcid}`;
        
        const pushSuccess = await pushMarkdownToGitHub({
          owner: env.GITHUB_OWNER,
          repo: env.GITHUB_REPO,
          branch: env.GITHUB_BRANCH,
          filePath,
          content,
          commitMessage,
          token: env.GITHUB_TOKEN,
        });

        if (!pushSuccess) {
          return Response.json({ success: true, warning: 'Saved to D1, but failed to push to GitHub.' }, { headers: corsHeaders });
        }

        return Response.json({ success: true, message: 'Article saved and pushed to GitHub successfully.' }, { headers: corsHeaders });
      }

      // 3. 記事取得エンドポイント
      if (path.startsWith('/api/wiki/') && method === 'GET') {
        const slug = path.split('/').pop();
        const result = await env.DB.prepare(`SELECT * FROM pages WHERE slug = ?`).bind(slug).first();

        if (!result) {
          return Response.json({ error: 'Page not found' }, { status: 404, headers: corsHeaders });
        }

        return Response.json(result, { headers: corsHeaders });
      }

      return Response.json({ error: 'Not Found' }, { status: 404, headers: corsHeaders });

    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  },
};
