const empleadosPorSucursal = {
  1: [ // La Popular
    { codigo: "201", nombre: "Dolores Tejada" },
    { codigo: "158", nombre: "Jennifer Garcia" },
    { codigo: "205", nombre: "Ana Aleman" },
    { codigo: "208", nombre: "Andy Mancia" },
    { codigo: "202", nombre: "Katherine Salinas" },
    { codigo: "206", nombre: "Nataly Flores" }
  ],
  2: [ // Salud 1
    { codigo: "1900", nombre: "Nathaly Estrada" },
    { codigo: "105", nombre: "Alexander Melgar" },
    { codigo: "163", nombre: "ADRIANA VANESSA RAMIREZ PASCACIO" },
    { codigo: "140", nombre: "Daniela Zelaya" },
    { codigo: "142", nombre: "Karen Figueroa" },
    { codigo: "159", nombre: "RONALDO RECINOS" },
    { codigo: "124", nombre: "Stefany Velasquez" },
    { codigo: "145", nombre: "William Herrera" }
  ],
  3: [ // Salud 2
    { codigo: "116", nombre: "Brissa Salazar" },
    { codigo: "123", nombre: "Helen Huezo" },
    { codigo: "149", nombre: "Amadeo Clemente" },
    { codigo: "103", nombre: "Cristian Humberto" },
    { codigo: "150", nombre: "Monica Estrada" },
    { codigo: "112", nombre: "Telma Henriquez" },
    { codigo: "117", nombre: "BYRON ESCOBAR" }
  ],
  4: [ // Salud 3
    { codigo: "115", nombre: "Rodrigo Marquez" },
    { codigo: "118", nombre: "Juan Melendez" },
    { codigo: "143", nombre: "Katlin Molina" },
    { codigo: "130", nombre: "Maribel Alberto" },
    { codigo: "125", nombre: "Domicilio" },
    { codigo: "107", nombre: "Sergio Tobias" },
    { codigo: "203", nombre: "Fernando Oliva" }
  ],
  5: [ // Salud 4
    { codigo: "310", nombre: "Elizabeth Callejas" },
    { codigo: "312", nombre: "Idalia Serrano" },
    { codigo: "313", nombre: "Glenda Anaya" },
    { codigo: "303", nombre: "Jonathan Melgar" },
    { codigo: "309", nombre: "Kevin Zamora" },
    { codigo: "-", nombre: "Mayerli Gutierrez" }
  ],
  6: [ // Salud 5
    { codigo: "1520", nombre: "Yamileth Perlera" },
    { codigo: "164", nombre: "Yessica Xiomara Hernandez" },
    { codigo: "157", nombre: "Marilyn Menjivar" },
    { codigo: "161", nombre: "Merlyn Lemus" },
    { codigo: "162", nombre: "WENDY SARAI MARTINEZ MEJIA" },
    { codigo: "155", nombre: "Willman Espinoza" }
  ]
};

function getEmpleadosPorSucursal(sucursal) {
  return empleadosPorSucursal[sucursal] || [];
}

module.exports = { getEmpleadosPorSucursal };