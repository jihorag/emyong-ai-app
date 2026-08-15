export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    keyConfigured: !!process.env.ANTHROPIC_API_KEY,
    runtime: 'node',
    ts: Date.now(),
  });
}
