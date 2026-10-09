#include <iostream>
#include <cstdlib>
#include <ctime>

int main() {
    std::srand(std::time(0));
    // Simulare parametru IoT industrial: debit apă (0-50 litri/minut)
    double debit = 5.0 + (std::rand() % 450) / 10.0; 

    // Headere obligatorii pentru serverul Vercel
    std::cout << "Status: 200 OK\r\n";
    std::cout << "Content-Type: application/json\r\n";
    std::cout << "Access-Control-Allow-Origin: *\r\n"; 
    std::cout << "\r\n"; 

    // Răspunsul JSON calculat în Cloud
    std::cout << "{\n";
    std::cout << "  \"status\": \"active\",\n";
    std::cout << "  \"path\": \"api/cpp/iot.cpp\",\n";
    std::cout << "  \"debit_apa\": " << debit << ",\n";
    std::cout << "  \"unitate\": \"L/min\"\n";
    std::cout << "}\n";

    return 0;
}
