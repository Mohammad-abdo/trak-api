import axios from 'axios';
import prisma from '../../utils/prisma.js';
import { generateToken } from '../../utils/jwtHelper.js';
import { fullUserSelect } from '../../utils/prismaSelects.js';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function splitName(fullName) {
    const parts = (fullName || '').trim().split(' ');
    return {
        firstName: parts[0] || 'User',
        lastName: parts.slice(1).join(' ') || parts[0] || 'User',
    };
}

function isBlocked(status) {
    return ['inactive', 'banned', 'deleted', 'suspended'].includes(status);
}

/**
 * Find or create a user from social provider data.
 * Look up by (uid + loginType) first, then by email.
 * If found → refresh link. If not found → register automatically.
 */
async function findOrCreateSocialUser({ uid, loginType, email, displayName, avatar }) {
    const orClauses = [{ uid, loginType }];
    if (email) orClauses.push({ email: email.toLowerCase() });

    let user = await prisma.user.findFirst({ where: { OR: orClauses } });

    if (user) {
        // Update social link fields and mark as active/online
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                uid,
                loginType,
                displayName: displayName || user.displayName,
                avatar: user.avatar || avatar || null,
                isVerified: true,
                status: user.status === 'pending' ? 'active' : user.status,
                lastActivedAt: new Date(),
                isOnline: true,
            },
            select: { ...fullUserSelect, loginType: true, displayName: true },
        });
    } else {
        const { firstName, lastName } = splitName(displayName);

        user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: email ? email.toLowerCase() : null,
                uid,
                loginType,
                displayName: displayName || null,
                avatar: avatar || null,
                userType: 'rider',
                status: 'active',
                isVerified: true,
                referralCode: `USR${Date.now()}`,
                lastActivedAt: new Date(),
                isOnline: true,
            },
            select: { ...fullUserSelect, loginType: true, displayName: true },
        });

        await prisma.wallet.create({ data: { userId: user.id, balance: 0 } });
    }

    return user;
}

// =============================================================================
//  Google Sign-In
//  Flutter flow: google_sign_in → get idToken → POST /auth/google { idToken }
// =============================================================================
export const googleSignIn = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            return res.status(400).json({ success: false, message: 'idToken is required' });
        }

        // Verify the idToken with Google's public tokeninfo endpoint (no extra package needed)
        let googleUser;
        try {
            const { data } = await axios.get(
                `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
            );
            googleUser = data;
        } catch {
            return res.status(401).json({ success: false, message: 'Invalid or expired Google token' });
        }

        // Confirm the token was issued for this app
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (clientId && googleUser.aud !== clientId) {
            return res.status(401).json({ success: false, message: 'Google token audience mismatch' });
        }

        const { sub: googleId, email, name, picture } = googleUser;
        if (!googleId) {
            return res.status(400).json({ success: false, message: 'Could not extract user info from Google token' });
        }

        const user = await findOrCreateSocialUser({
            uid: googleId,
            loginType: 'google',
            email,
            displayName: name,
            avatar: picture || null,
        });

        if (isBlocked(user.status)) {
            return res.status(403).json({ success: false, message: `Account is ${user.status}. Contact support.` });
        }

        const token = generateToken(user.id);
        return res.json({
            success: true,
            message: 'Google sign-in successful',
            data: { token, user },
        });
    } catch (error) {
        console.error('Google sign-in error:', error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: error.message || 'Google sign-in failed' });
    }
};

// =============================================================================
//  Facebook Sign-In
//  Flutter flow: flutter_facebook_auth → get accessToken → POST /auth/facebook { accessToken }
// =============================================================================
export const facebookSignIn = async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken) {
            return res.status(400).json({ success: false, message: 'accessToken is required' });
        }

        // Verify the accessToken with Facebook Graph API
        let fbUser;
        try {
            const { data } = await axios.get(
                `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
            );
            fbUser = data;
        } catch {
            return res.status(401).json({ success: false, message: 'Invalid or expired Facebook token' });
        }

        const { id: facebookId, name, email, picture } = fbUser;
        if (!facebookId) {
            return res.status(400).json({ success: false, message: 'Could not extract user info from Facebook' });
        }

        // Optional: verify token was issued for this app (recommended in production)
        const appId = process.env.FACEBOOK_APP_ID;
        const appSecret = process.env.FACEBOOK_APP_SECRET;
        if (appId && appSecret) {
            try {
                const { data: debug } = await axios.get(
                    `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`
                );
                if (!debug?.data?.is_valid || debug?.data?.app_id !== appId) {
                    return res.status(401).json({ success: false, message: 'Facebook token is not valid for this app' });
                }
            } catch {
                // If debug_token check fails, skip (non-critical unless FB_APP_SECRET is set)
            }
        }

        const avatarUrl = picture?.data?.url || null;

        const user = await findOrCreateSocialUser({
            uid: facebookId,
            loginType: 'facebook',
            email: email || null,
            displayName: name,
            avatar: avatarUrl,
        });

        if (isBlocked(user.status)) {
            return res.status(403).json({ success: false, message: `Account is ${user.status}. Contact support.` });
        }

        const token = generateToken(user.id);
        return res.json({
            success: true,
            message: 'Facebook sign-in successful',
            data: { token, user },
        });
    } catch (error) {
        console.error('Facebook sign-in error:', error?.response?.data || error.message);
        return res.status(500).json({ success: false, message: error.message || 'Facebook sign-in failed' });
    }
};
