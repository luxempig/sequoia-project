const express = require('express');
const crypto = require('crypto');
const { execSync } = require('child_process');

const app = express();
const PORT = 9000;
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'your-webhook-secret';

app.use(express.json());

// Verify GitHub webhook signature
function verifySignature(body, signature) {
    const expectedSignature = crypto
        .createHmac('sha256', SECRET)
        .update(body)
        .digest('hex');
    
    return `sha256=${expectedSignature}` === signature;
}

app.post('/webhook', (req, res) => {
    const signature = req.get('X-Hub-Signature-256');
    const body = JSON.stringify(req.body);
    
    if (!verifySignature(body, signature)) {
        console.log('Invalid signature');
        return res.status(401).send('Unauthorized');
    }
    
    const event = req.get('X-GitHub-Event');
    
    if (event === 'push' && req.body.ref === 'refs/heads/main') {
        console.log('Received push to main branch, triggering deployment...');
        
        try {
            execSync('/home/ec2-user/sequoia-backend/deploy.sh', { 
                stdio: 'inherit',
                cwd: '/home/ec2-user/sequoia-backend'
            });
            res.status(200).send('Deployment triggered successfully');
        } catch (error) {
            console.error('Deployment failed:', error);
            res.status(500).send('Deployment failed');
        }
    } else {
        res.status(200).send('Event ignored');
    }
});

app.get('/health', (req, res) => {
    res.status(200).send('Webhook server is running');
});

app.listen(PORT, () => {
    console.log(`Webhook server listening on port ${PORT}`);
});