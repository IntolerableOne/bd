import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
    // Change these values to your desired admin credentials
    const email = 'admin@birthdebrief.com';
    const password = 'Bowland123';
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: 'admin'
            }
        });
        
        console.log('Admin user created:', user);
    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();