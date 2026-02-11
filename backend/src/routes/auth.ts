import express from 'express';
import { createUserWithPassword, loadUserByIdentity } from '../repositories/users';
import { createStudentProfile, getStudentProfileByUserId } from '../repositories/studentProfiles';
import { getDriverProfileByUserId } from '../repositories/driverProfiles';
import { getDrivingSchoolById } from '../repositories/drivingSchools';
import { hashPassword, comparePassword } from '../services/password';
import { issueLocalJwt } from '../services/jwtIssuer';
import { sendPasswordResetEmail } from '../services/email';
import {
    createPasswordResetToken,
    findValidPasswordResetToken,
    markTokenUsed,
    updateUserPassword,
} from '../repositories/passwordResetTokens';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password: string): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (password.length > 128) return 'Password must be at most 128 characters long';
    return null;
}

router.post('/register', async (req, res, next) => {
    try {
        const { email, password, role, drivingSchoolId, fullName } = req.body;

        if (!email || !password || !role || !drivingSchoolId || !fullName) {
            res.status(400).json({ error: 'Missing required fields: email, password, role, drivingSchoolId, fullName' });
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            res.status(400).json({ error: passwordError });
            return;
        }

        if (role !== 'STUDENT') {
            // For now only allow public registration for students
            res.status(400).json({ error: 'Public registration is only available for students' });
            return;
        }

        const school = await getDrivingSchoolById(drivingSchoolId);
        if (!school || school.status !== 'active') {
            res.status(400).json({ error: 'Invalid or inactive driving school' });
            return;
        }

        const existing = await loadUserByIdentity(undefined, email);
        if (existing) {
            res.status(400).json({ error: 'Email already in use' });
            return;
        }

        const hashedPassword = await hashPassword(password);

        const user = await createUserWithPassword({
            email,
            passwordHash: hashedPassword,
            role,
            drivingSchoolId,
        });

        await createStudentProfile({
            userId: user.id,
            drivingSchoolId,
            fullName,
        });

        const token = issueLocalJwt({
            sub: `local-${user.id}`,
            email: user.email,
            role: user.role,
            drivingSchoolId: user.drivingSchoolId,
            name: fullName,
        });

        res.status(201).json({ token, user });

    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }

        const user = await loadUserByIdentity(undefined, email);
        if (!user || !user.passwordHash) {
            // If user has no password hash (e.g. google auth user), fail
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const isValid = await comparePassword(password, user.passwordHash);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Look up display name from profile
        let displayName: string | undefined;
        if (user.drivingSchoolId) {
            if (user.role === 'DRIVER') {
                const profile = await getDriverProfileByUserId(user.id, user.drivingSchoolId);
                displayName = profile?.fullName;
            } else if (user.role === 'STUDENT') {
                const profile = await getStudentProfileByUserId(user.id, user.drivingSchoolId);
                displayName = profile?.fullName;
            }
        }

        const token = issueLocalJwt({
            sub: `local-${user.id}`,
            email: user.email,
            role: user.role,
            drivingSchoolId: user.drivingSchoolId,
            name: displayName,
        });

        res.json({ token, user });

    } catch (err) {
        next(err);
    }
});

// Request password reset email
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }

        if (!EMAIL_REGEX.test(email)) {
            res.status(400).json({ error: 'Invalid email format' });
            return;
        }

        // Always return same response to prevent email enumeration
        const successMessage = 'If an account exists with this email, you will receive a password reset link.';

        const user = await loadUserByIdentity(undefined, email);

        // Only send email if user exists and has a password (local auth)
        if (user && user.passwordHash) {
            const token = await createPasswordResetToken(user.id);
            await sendPasswordResetEmail(email, token);
        }

        // Always return success to prevent user enumeration
        res.json({ message: successMessage });

    } catch (err) {
        next(err);
    }
});

// Reset password with token
router.post('/reset-password', async (req, res, next) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            res.status(400).json({ error: 'Token and password are required' });
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            res.status(400).json({ error: passwordError });
            return;
        }

        const resetToken = await findValidPasswordResetToken(token);

        if (!resetToken) {
            res.status(400).json({ error: 'Invalid or expired reset token. Please request a new password reset.' });
            return;
        }

        // Hash new password and update user
        const passwordHash = await hashPassword(password);
        await updateUserPassword(resetToken.userId, passwordHash);

        // Mark token as used
        await markTokenUsed(resetToken.id);

        res.json({ message: 'Password has been reset successfully. You can now login with your new password.' });

    } catch (err) {
        next(err);
    }
});

export default router;
