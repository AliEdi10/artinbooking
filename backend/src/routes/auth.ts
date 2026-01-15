import express from 'express';
import { createUserWithPassword, loadUserByIdentity } from '../repositories/users';
import { createStudentProfile } from '../repositories/studentProfiles';
import { hashPassword, comparePassword } from '../services/password';
import { issueLocalJwt } from '../services/jwtIssuer';

const router = express.Router();

router.post('/register', async (req, res, next) => {
    try {
        const { email, password, role, drivingSchoolId, fullName } = req.body;

        if (!email || !password || !role || !drivingSchoolId || !fullName) {
            res.status(400).json({ error: 'Missing required fields: email, password, role, drivingSchoolId, fullName' });
            return;
        }

        if (role !== 'STUDENT') {
            // For now only allow public registration for students
            res.status(400).json({ error: 'Public registration is only available for students' });
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
            drivingSchoolId: user.drivingSchoolId
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

        const token = issueLocalJwt({
            sub: `local-${user.id}`,
            email: user.email,
            role: user.role,
            drivingSchoolId: user.drivingSchoolId
        });

        res.json({ token, user });

    } catch (err) {
        next(err);
    }
});

export default router;
