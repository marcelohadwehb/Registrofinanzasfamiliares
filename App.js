import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// Define las categorías y subcategorías según tus especificaciones
const categories = {
    "Gastos fijos del hogar": ["Dividendo", "Luz", "Agua", "Gas", "Basura", "Wifi", "Streaming", "Mantención Aire", "Plan móvil"],
    "Alimentación": ["Supermercado", "Feria"],
    "Educación": ["Matrícula jardín", "Mensualidad jardín"],
    "Salud": ["Plan", "Medicamentos"],
    "Transporte": ["BIP", "Combustible", "Permiso circulación", "Mantención", "TAG"],
    "Gin": ["Comida", "Salud"],
    "Eventos": ["Navidad", "Vacaciones", "Cumple MyM", "Cumple hija", "Cumpleaños"],
    "Presupuestos mensuales": ["BR", "Hija", "DT"]
};

// Componente principal de la aplicación
function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState('');
    const [records, setRecords] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [dimension, setDimension] = useState('');
    const [subDimension, setSubDimension] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('Gasto'); // 'Gasto' o 'Ingreso'
    const [isEditing, setIsEditing] = useState(false);
    const [editRecordId, setEditRecordId] = useState(null);
    const [message, setMessage] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState(null);

    // Inicialización de Firebase y autenticación
    useEffect(() => {
        try {
            const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Iniciar sesión con token personalizado o de forma anónima
            const signIn = async () => {
                try {
                    if (typeof __initial_auth_token !== 'undefined') {
                        await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                    } else {
                        await signInAnonymously(firebaseAuth);
                    }
                } catch (error) {
                    console.error("Error al iniciar sesión en Firebase:", error);
                    setMessage("Error al iniciar sesión. Por favor, inténtalo de nuevo.");
                }
            };
            signIn();

            // Escuchar cambios en el estado de autenticación
            const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    setUserId(crypto.randomUUID()); // Generar un ID aleatorio si no hay usuario autenticado
                }
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Error al inicializar Firebase:", error);
            setMessage("Error al inicializar la aplicación. Por favor, recarga la página.");
        }
    }, []);

    // Escuchar cambios en los registros de Firestore
    useEffect(() => {
        if (db && userId) {
            // Ruta de la colección para datos públicos compartidos
            const recordsCollectionRef = collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/financialRecords`);
            const q = query(recordsCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedRecords = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Ordenar por fecha en orden descendente
                fetchedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
                setRecords(fetchedRecords);
            }, (error) => {
                console.error("Error al obtener registros:", error);
                setMessage("Error al cargar los registros financieros.");
            });

            return () => unsubscribe();
        }
    }, [db, userId]);

    // Manejar el envío del formulario para añadir o actualizar un registro
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!amount || !dimension || !subDimension) {
            setMessage("Por favor, rellena todos los campos obligatorios (Monto, Dimensión, Subdimensión).");
            return;
        }

        const recordData = {
            date: currentDate,
            amount: parseFloat(amount),
            dimension,
            subDimension,
            description,
            type,
            userId, // Registrar el ID del usuario que creó/modificó el registro
            timestamp: new Date() // Añadir un timestamp para ordenar si es necesario
        };

        try {
            if (isEditing) {
                const recordRef = doc(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/financialRecords`, editRecordId);
                await updateDoc(recordRef, recordData);
                setMessage("Registro actualizado exitosamente.");
                setIsEditing(false);
                setEditRecordId(null);
            } else {
                await addDoc(collection(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/financialRecords`), recordData);
                setMessage("Registro añadido exitosamente.");
            }
            // Limpiar formulario
            setAmount('');
            setDimension('');
            setSubDimension('');
            setDescription('');
            setType('Gasto');
            setCurrentDate(new Date().toISOString().split('T')[0]);
        } catch (error) {
            console.error("Error al guardar el registro:", error);
            setMessage("Error al guardar el registro. Por favor, inténtalo de nuevo.");
        }
    };

    // Cargar datos del registro para edición
    const handleEdit = (record) => {
        setIsEditing(true);
        setEditRecordId(record.id);
        setCurrentDate(record.date);
        setAmount(record.amount.toString());
        setDimension(record.dimension);
        setSubDimension(record.subDimension);
        setDescription(record.description);
        setType(record.type);
        setMessage('');
    };

    // Preparar para eliminar un registro (mostrar modal de confirmación)
    const confirmDelete = (record) => {
        setRecordToDelete(record);
        setShowConfirmModal(true);
    };

    // Eliminar un registro de Firestore
    const handleDelete = async () => {
        if (!recordToDelete) return;

        try {
            await deleteDoc(doc(db, `artifacts/${typeof __app_id !== 'undefined' ? __app_id : 'default-app-id'}/public/data/financialRecords`, recordToDelete.id));
            setMessage("Registro eliminado exitosamente.");
            setShowConfirmModal(false);
            setRecordToDelete(null);
        } catch (error) {
            console.error("Error al eliminar el registro:", error);
            setMessage("Error al eliminar el registro. Por favor, inténtalo de nuevo.");
        }
    };

    // Calcular totales
    const calculateTotals = useCallback(() => {
        let totalIncome = 0;
        let totalExpenses = 0;
        records.forEach(record => {
            if (record.type === 'Ingreso') {
                totalIncome += record.amount;
            } else {
                totalExpenses += record.amount;
            }
        });
        return { totalIncome, totalExpenses };
    }, [records]);

    const { totalIncome, totalExpenses } = calculateTotals();

    // Exportar datos a CSV
    const exportToCSV = () => {
        if (records.length === 0) {
            setMessage("No hay datos para exportar.");
            return;
        }

        const headers = ["Fecha", "Tipo", "Monto", "Dimensión", "Subdimensión", "Descripción", "Usuario ID"];
        const csvRows = [];
        csvRows.push(headers.join(','));

        records.forEach(record => {
            const row = [
                record.date,
                record.type,
                record.amount,
                record.dimension,
                record.subDimension,
                `"${record.description.replace(/"/g, '""')}"`, // Escapar comillas dobles
                record.userId
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'registros_financieros_familiares.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setMessage("Datos exportados exitosamente a CSV.");
        } else {
            setMessage("Tu navegador no soporta la descarga de archivos.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans flex flex-col items-center">
            <div className="w-full max-w-4xl bg-white shadow-lg rounded-lg p-6 mb-8">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Registro Financiero Familiar</h1>
                <p className="text-center text-sm text-gray-600 mb-4">
                    ID de Usuario: <span className="font-mono text-blue-600 break-all">{userId || 'Cargando...'}</span>
                </p>

                {message && (
                    <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <span className="block sm:inline">{message}</span>
                        <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setMessage('')}>
                            <svg className="fill-current h-6 w-6 text-blue-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Cerrar</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.103l-2.651 3.746a1.2 1.2 0 1 1-1.697-1.697l3.746-2.651-3.746-2.651a1.2 1.2 0 0 1 1.697-1.697L10 8.897l2.651-3.746a1.2 1.2 0 0 1 1.697 1.697L11.103 10l3.746 2.651a1.2 1.2 0 0 1 0 1.698z"/></svg>
                        </span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div>
                        <label htmlFor="date" className="block text-gray-700 text-sm font-bold mb-2">Fecha:</label>
                        <input
                            type="date"
                            id="date"
                            className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={currentDate}
                            onChange={(e) => setCurrentDate(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="amount" className="block text-gray-700 text-sm font-bold mb-2">Monto:</label>
                        <input
                            type="number"
                            id="amount"
                            className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="Ej: 15000"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            step="0.01"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="dimension" className="block text-gray-700 text-sm font-bold mb-2">Dimensión:</label>
                        <select
                            id="dimension"
                            className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={dimension}
                            onChange={(e) => {
                                setDimension(e.target.value);
                                setSubDimension(''); // Reset sub-dimension when dimension changes
                            }}
                            required
                        >
                            <option value="">Selecciona una dimensión</option>
                            {Object.keys(categories).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="subDimension" className="block text-gray-700 text-sm font-bold mb-2">Subdimensión:</label>
                        <select
                            id="subDimension"
                            className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            value={subDimension}
                            onChange={(e) => setSubDimension(e.target.value)}
                            required
                            disabled={!dimension}
                        >
                            <option value="">Selecciona una subdimensión</option>
                            {dimension && categories[dimension] && categories[dimension].map(subCat => (
                                <option key={subCat} value={subCat}>{subCat}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Descripción (Opcional):</label>
                        <textarea
                            id="description"
                            className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="Añade una descripción detallada"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows="2"
                        ></textarea>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Tipo:</label>
                        <div className="flex items-center space-x-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    className="form-radio text-red-600"
                                    name="type"
                                    value="Gasto"
                                    checked={type === 'Gasto'}
                                    onChange={() => setType('Gasto')}
                                />
                                <span className="ml-2 text-gray-700">Gasto</span>
                            </label>
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    className="form-radio text-green-600"
                                    name="type"
                                    value="Ingreso"
                                    checked={type === 'Ingreso'}
                                    onChange={() => setType('Ingreso')}
                                />
                                <span className="ml-2 text-gray-700">Ingreso</span>
                            </label>
                        </div>
                    </div>
                    <div className="md:col-span-2 flex justify-end space-x-4">
                        <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-xl focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105"
                        >
                            {isEditing ? 'Actualizar Registro' : 'Añadir Registro'}
                        </button>
                        {isEditing && (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditRecordId(null);
                                    setAmount('');
                                    setDimension('');
                                    setSubDimension('');
                                    setDescription('');
                                    setType('Gasto');
                                    setCurrentDate(new Date().toISOString().split('T')[0]);
                                    setMessage('');
                                }}
                                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-xl focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105"
                            >
                                Cancelar Edición
                            </button>
                        )}
                    </div>
                </form>

                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Registros Financieros</h2>
                    <button
                        onClick={exportToCSV}
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl focus:outline-none focus:shadow-outline transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Exportar a CSV
                    </button>
                </div>

                <div className="mb-6 p-4 bg-gray-50 rounded-lg shadow-inner">
                    <p className="text-lg font-semibold text-gray-700">
                        Total Ingresos: <span className="text-green-600">${totalIncome.toFixed(2)}</span>
                    </p>
                    <p className="text-lg font-semibold text-gray-700">
                        Total Gastos: <span className="text-red-600">${totalExpenses.toFixed(2)}</span>
                    </p>
                    <p className="text-xl font-bold text-gray-800 mt-2">
                        Balance: <span className={totalIncome - totalExpenses >= 0 ? "text-blue-600" : "text-red-600"}>${(totalIncome - totalExpenses).toFixed(2)}</span>
                    </p>
                </div>

                {records.length === 0 ? (
                    <p className="text-center text-gray-500">No hay registros aún. ¡Añade uno para empezar!</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg shadow-md">
                        <table className="min-w-full bg-white">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tl-lg">Fecha</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tipo</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Monto</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Dimensión</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Subdimensión</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Descripción</th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-600 uppercase tracking-wider rounded-tr-lg">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {records.map(record => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{record.date}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.type === 'Ingreso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                {record.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">${record.amount.toFixed(2)}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{record.dimension}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm text-gray-800">{record.subDimension}</td>
                                        <td className="py-3 px-4 text-sm text-gray-800 max-w-xs overflow-hidden text-ellipsis">{record.description || '-'}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(record)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                                title="Editar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.109 7.026l-2.828 2.828-1.559-1.559 2.828-2.828 1.559 1.559z" />
                                                    <path fillRule="evenodd" d="M2 13.5V16h2.5L14.414 6.586l-2.5-2.5L2 13.5zm10.924-8.707a1 1 0 00-1.414 0l-7 7a1 1 0 000 1.414l7 7a1 1 0 001.414 0l7-7a1 1 0 000-1.414l-7-7z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(record)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Eliminar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Confirmación */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
                        <h3 className="text-lg font-bold mb-4">Confirmar Eliminación</h3>
                        <p className="mb-6">¿Estás seguro de que quieres eliminar este registro?</p>
                        <div className="flex justify-end space-x-4">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl transition duration-300 ease-in-out"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
