/**
 * Utilitário para geração de senhas temporárias seguras
 * Atende aos requisitos de complexidade: letras maiúsculas, minúsculas, números e caracteres especiais.
 */
function generateTemporaryPassword(length = 10) {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '@#$%&*!';
    
    const all = uppercase + lowercase + numbers + symbols;
    
    // Garante ao menos um caractere de cada grupo
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    for (let i = 4; i < length; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    
    // Embaralha os caracteres
    return password.split('').sort(() => 0.5 - Math.random()).join('');
}

module.exports = {
    generateTemporaryPassword
};
