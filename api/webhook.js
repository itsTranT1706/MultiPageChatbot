export default function handler(req, res) {
  if (req.method === 'POST') {
    const { name } = req.body;
    res.status(200).json({ welcome: `Hello, ${name}` });
  } else {
    res.status(200).json({ msg: 'Method not allowed' });
  }
}